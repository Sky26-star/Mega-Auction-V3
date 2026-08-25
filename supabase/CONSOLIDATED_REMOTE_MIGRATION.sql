-- CONSOLIDATED REMOTE MIGRATION FOR MEGA AUCTION (00023 + 00024 + BID ENGINE)
-- Copy and paste this ENTIRE block into your Supabase Dashboard SQL Editor (Project: zkrxuowctprncwnymnvg) and click RUN.

-- 0. BACKWARD COMPATIBILITY TABLE: public.player_set_players
CREATE TABLE IF NOT EXISTS public.player_set_players (
  player_id UUID,
  player_set_id UUID
);

INSERT INTO public.player_set_players (player_id, player_set_id)
SELECT id AS player_id, player_set_id FROM public.players;

GRANT ALL ON public.player_set_players TO authenticated, service_role, anon;

-- 1. HELPER FUNCTION: public._get_lot_get_ready_expires_at
DROP FUNCTION IF EXISTS public._get_lot_get_ready_expires_at(TIMESTAMPTZ, INT);

CREATE OR REPLACE FUNCTION public._get_lot_get_ready_expires_at(
  p_timer_expires_at TIMESTAMPTZ,
  p_timer_duration_seconds INT DEFAULT 15
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_timer_expires_at IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_timer_expires_at - (COALESCE(p_timer_duration_seconds, 15) * INTERVAL '1 second');
END;
$$;

GRANT EXECUTE ON FUNCTION public._get_lot_get_ready_expires_at(TIMESTAMPTZ, INT) TO authenticated, service_role, anon;

-- 2. Create activate_lot_timer RPC (Idempotent Two-Phase Timer Engine)
CREATE OR REPLACE FUNCTION public.activate_lot_timer(
  p_auction_id UUID,
  p_lot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_lot RECORD;
  v_timer_sec INT := 15;
  v_timer_expires TIMESTAMPTZ;
BEGIN
  -- Level 1 Lock: Auctions table
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'AUCTION_NOT_FOUND');
  END IF;

  IF v_auction.status NOT IN ('IN_PROGRESS', 'LIVE') THEN
    RETURN jsonb_build_object('success', false, 'status', 'AUCTION_NOT_LIVE');
  END IF;

  -- Level 2 Lock: Target lot
  SELECT al.* INTO v_lot
  FROM public.auction_lots al
  WHERE al.id = p_lot_id AND al.auction_id = p_auction_id
  FOR UPDATE;

  IF v_lot.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'LOT_NOT_FOUND');
  END IF;

  -- Idempotency Guard: If timer_expires_at is ALREADY set, return authoritative state immediately without resetting
  IF v_lot.timer_expires_at IS NOT NULL THEN
    RETURN public.get_authoritative_auction_state(v_auction.room_id);
  END IF;

  -- Activate Timer Atomically on Server
  v_timer_sec := COALESCE(v_lot.timer_duration_seconds, 15);
  v_timer_expires := clock_timestamp() + (v_timer_sec * INTERVAL '1 second');

  UPDATE public.auction_lots
  SET timer_expires_at = v_timer_expires,
      timer_duration_seconds = v_timer_sec,
      status = 'BIDDING'
  WHERE id = v_lot.id;

  -- Emit LOT_TIMER_ACTIVATED Event
  PERFORM public._emit_auction_event(
    p_auction_id,
    'LOT_TIMER_ACTIVATED',
    jsonb_build_object(
      'lot_id', v_lot.id,
      'lot_index', v_lot.lot_index,
      'timer_expires_at', to_char(v_timer_expires AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    NULL
  );

  RETURN public.get_authoritative_auction_state(v_auction.room_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_lot_timer(UUID, UUID) TO authenticated, service_role, anon;

-- 3. Update get_authoritative_auction_state to include age, batting_hand, and stats in v_queue and v_current_player
CREATE OR REPLACE FUNCTION public.get_authoritative_auction_state(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_active_lot RECORD;
  v_current_player RECORD;
  v_bid_count INT := 0;
  v_effective_bid INT := 0;
  v_timer_sec INT := 15;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_timer_expires_iso TEXT := NULL;
  v_is_get_ready BOOLEAN := false;
  v_get_ready_expires_iso TEXT := NULL;
  v_teams JSONB := '[]'::jsonb;
  v_queue JSONB := '[]'::jsonb;
BEGIN
  -- Fetch room's active auction
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.room_id = p_room_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'NO_AUCTION_FOUND',
      'message', 'No auction exists for this room'
    );
  END IF;

  -- Fetch current lot
  IF v_auction.current_lot_id IS NOT NULL THEN
    SELECT al.* INTO v_active_lot
    FROM public.auction_lots al
    WHERE al.id = v_auction.current_lot_id;
  END IF;

  IF v_active_lot.id IS NULL THEN
    SELECT al.* INTO v_active_lot
    FROM public.auction_lots al
    WHERE al.auction_id = v_auction.id AND al.lot_index = v_auction.current_lot_index;
  END IF;

  -- Build timer state if active lot exists
  IF v_active_lot.id IS NOT NULL THEN
    v_timer_sec := COALESCE(v_active_lot.timer_duration_seconds, 15);
    IF v_active_lot.timer_expires_at IS NOT NULL THEN
      v_timer_expires_iso := to_char(v_active_lot.timer_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      -- Check GET READY window
      IF (v_active_lot.timer_expires_at - (v_timer_sec * INTERVAL '1 second')) > v_now THEN
        v_is_get_ready := true;
        v_get_ready_expires_iso := to_char(
          (v_active_lot.timer_expires_at - (v_timer_sec * INTERVAL '1 second')) AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        );
      END IF;
    END IF;

    SELECT p.* INTO v_current_player
    FROM public.players p
    WHERE p.id = v_active_lot.player_id;

    SELECT COUNT(*) INTO v_bid_count
    FROM public.bids b
    WHERE b.lot_id = v_active_lot.id AND b.is_valid = true;

    -- Effective current bid
    IF v_bid_count > 0 AND v_active_lot.current_bid > 0 THEN
      v_effective_bid := v_active_lot.current_bid;
    ELSE
      v_effective_bid := COALESCE(v_active_lot.base_price, v_current_player.base_price, 200);
    END IF;
  ELSE
    v_effective_bid := 0;
  END IF;

  -- Fetch teams list
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'auction_id', t.auction_id,
      'name', t.name,
      'short_name', t.short_name,
      'color', t.color,
      'purse', t.purse,
      'initial_purse', t.initial_purse,
      'players_bought', t.players_bought,
      'overseas_count', t.overseas_count,
      'is_bot', t.is_bot
    ) ORDER BY t.name ASC
  ), '[]'::jsonb) INTO v_teams
  FROM public.teams t
  WHERE t.auction_id = v_auction.id;

  -- Fetch player queue with full master data (age, batting_hand, stats)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'playerId', p.id,
      'name', p.name,
      'category', p.category,
      'role', p.role,
      'country', p.country,
      'age', p.age,
      'battingHand', p.batting_hand,
      'basePrice', al.base_price,
      'auctionOrder', al.lot_index + 1,
      'status', CASE
                  WHEN al.status IN ('BIDDING', 'ACTIVE') THEN 'LIVE'
                  WHEN al.status = 'SOLD' THEN 'SOLD'
                  WHEN al.status = 'UNSOLD' THEN 'UNSOLD'
                  ELSE 'UPCOMING'
                END,
      'image_url', p.image_url,
      'stats', jsonb_build_object(
        'matches', COALESCE(p.matches, 0),
        'runs', COALESCE(p.runs, 0),
        'average', COALESCE(p.batting_average, 0),
        'strikeRate', COALESCE(p.strike_rate, 0),
        'hundreds', COALESCE(p.hundreds, 0),
        'fifties', COALESCE(p.fifties, 0),
        'highest', COALESCE(p.highest_score, 0),
        'wickets', COALESCE(p.wickets, 0),
        'economy', COALESCE(p.economy_rate, 0),
        'bestBowling', COALESCE(p.best_bowling, '')
      )
    ) ORDER BY al.lot_index ASC
  ), '[]'::jsonb) INTO v_queue
  FROM public.auction_lots al
  JOIN public.players p ON p.id = al.player_id
  WHERE al.auction_id = v_auction.id;

  RETURN jsonb_build_object(
    'success', true,
    'auctionId', v_auction.id,
    'roomId', p_room_id,
    'lotId', COALESCE(v_active_lot.id, NULL),
    'auctionStatus', CASE
                       WHEN v_auction.status = 'IN_PROGRESS' THEN 'LIVE'
                       WHEN v_auction.status = 'PAUSED' THEN 'PAUSED'
                       WHEN v_auction.status = 'COMPLETED' THEN 'COMPLETED'
                       ELSE 'NOT_STARTED'
                     END,
    'currentPlayerIndex', v_auction.current_lot_index,
    'currentCategory', COALESCE(v_current_player.category, NULL),
    'currentBid', v_effective_bid,
    'highestBidderId', CASE WHEN v_bid_count > 0 THEN COALESCE(v_active_lot.highest_bidder_team_id, NULL) ELSE NULL END,
    'bidCount', v_bid_count,
    'timerExpiresAt', v_timer_expires_iso,
    'timerDurationSeconds', v_timer_sec,
    'isGetReady', v_is_get_ready,
    'getReadyExpiresAt', v_get_ready_expires_iso,
    'currentPlayer', CASE WHEN v_current_player.id IS NOT NULL THEN jsonb_build_object(
      'playerId', v_current_player.id,
      'name', v_current_player.name,
      'category', v_current_player.category,
      'role', v_current_player.role,
      'country', v_current_player.country,
      'age', v_current_player.age,
      'battingHand', v_current_player.batting_hand,
      'basePrice', COALESCE(v_active_lot.base_price, v_current_player.base_price),
      'auctionOrder', v_active_lot.lot_index + 1,
      'status', 'LIVE',
      'image_url', v_current_player.image_url,
      'stats', jsonb_build_object(
        'matches', COALESCE(v_current_player.matches, 0),
        'runs', COALESCE(v_current_player.runs, 0),
        'average', COALESCE(v_current_player.batting_average, 0),
        'strikeRate', COALESCE(v_current_player.strike_rate, 0),
        'hundreds', COALESCE(v_current_player.hundreds, 0),
        'fifties', COALESCE(v_current_player.fifties, 0),
        'highest', COALESCE(v_current_player.highest_score, 0),
        'wickets', COALESCE(v_current_player.wickets, 0),
        'economy', COALESCE(v_current_player.economy_rate, 0),
        'bestBowling', COALESCE(v_current_player.best_bowling, '')
      )
    ) ELSE NULL END,
    'teamsList', v_teams,
    'playerQueue', v_queue
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authoritative_auction_state(UUID) TO authenticated, service_role, anon;

-- 4. Update initialize_and_start_auction for two-phase start (timer_expires_at = NULL initially)
DROP FUNCTION IF EXISTS public.initialize_and_start_auction(UUID);
DROP FUNCTION IF EXISTS public.initialize_and_start_auction(UUID, UUID);

CREATE OR REPLACE FUNCTION public.initialize_and_start_auction(
  p_room_id UUID,
  p_player_set_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room RECORD;
  v_auction RECORD;
  v_target_set_id UUID;
  v_first_lot_id UUID := NULL;
  v_existing_lots INT := 0;
  v_total_lots_inserted INT := 0;
  v_timer_sec INT := 15;
BEGIN
  -- Read room details
  SELECT r.* INTO v_room FROM public.rooms r WHERE r.id = p_room_id;
  IF v_room.id IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND: Room % does not exist', p_room_id;
  END IF;

  v_timer_sec := COALESCE(NULLIF((v_room.settings->>'timer_duration_seconds')::int, 0), 15);

  -- Host Authorization Guard
  IF auth.role() = 'authenticated' AND v_room.host_id != auth.uid() THEN
    RAISE EXCEPTION 'UNAUTHORIZED_NOT_HOST: Only the room host can start the auction';
  END IF;

  -- Read or create auction row with Level 1 lock
  SELECT a.* INTO v_auction FROM public.auctions a WHERE a.room_id = p_room_id ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE;

  -- If auction is ALREADY IN_PROGRESS, return state
  IF v_auction.id IS NOT NULL AND v_auction.status = 'IN_PROGRESS' THEN
    RETURN public.get_authoritative_auction_state(p_room_id);
  END IF;

  IF v_auction.id IS NULL THEN
    v_target_set_id := COALESCE(p_player_set_id, (v_room.settings->>'player_set_id')::uuid);
    IF v_target_set_id IS NULL THEN
      SELECT id INTO v_target_set_id FROM public.player_sets LIMIT 1;
    END IF;

    INSERT INTO public.auctions (
      room_id, player_set_id, status, current_lot_index, created_at
    ) VALUES (
      p_room_id, v_target_set_id, 'LOBBY', 0, NOW()
    ) RETURNING * INTO v_auction;
  END IF;

  -- Determine player set
  v_target_set_id := COALESCE(p_player_set_id, v_auction.player_set_id, (v_room.settings->>'player_set_id')::uuid);
  IF v_target_set_id IS NULL THEN
    SELECT id INTO v_target_set_id FROM public.player_sets LIMIT 1;
  END IF;

  -- Check existing lots
  SELECT COUNT(*) INTO v_existing_lots FROM public.auction_lots WHERE auction_id = v_auction.id;

  IF v_existing_lots = 0 THEN
    INSERT INTO public.auction_lots (
      id, auction_id, player_id, lot_index, status, base_price, current_bid, timer_duration_seconds, created_at
    )
    SELECT
      gen_random_uuid(),
      v_auction.id,
      p.id,
      (ROW_NUMBER() OVER (
        ORDER BY
          CASE UPPER(p.category)
            WHEN 'MARQUEE' THEN 1
            WHEN 'ICON' THEN 1
            WHEN 'A' THEN 2
            WHEN 'ELITE' THEN 2
            WHEN 'B' THEN 3
            WHEN 'PREMIER' THEN 3
            WHEN 'C' THEN 4
            WHEN 'CORE' THEN 4
            WHEN 'D' THEN 5
            WHEN 'RISING' THEN 5
            ELSE 6
          END ASC,
          p.name ASC
      ) - 1)::int AS lot_index,
      CASE WHEN ROW_NUMBER() OVER (
        ORDER BY
          CASE UPPER(p.category)
            WHEN 'MARQUEE' THEN 1
            WHEN 'ICON' THEN 1
            WHEN 'A' THEN 2
            WHEN 'ELITE' THEN 2
            WHEN 'B' THEN 3
            WHEN 'PREMIER' THEN 3
            WHEN 'C' THEN 4
            WHEN 'CORE' THEN 4
            WHEN 'D' THEN 5
            WHEN 'RISING' THEN 5
            ELSE 6
          END ASC,
          p.name ASC
      ) = 1 THEN 'BIDDING' ELSE 'PENDING' END AS status,
      p.base_price,
      p.base_price,
      v_timer_sec,
      NOW()
    FROM public.players p
    WHERE p.player_set_id = v_target_set_id;

    GET DIAGNOSTICS v_total_lots_inserted = ROW_COUNT;
  END IF;

  -- Resolve Lot 0's ID
  SELECT id INTO v_first_lot_id
  FROM public.auction_lots
  WHERE auction_id = v_auction.id AND lot_index = 0
  LIMIT 1;

  -- TWO-PHASE TIMER START: Set status to BIDDING but keep timer_expires_at = NULL until client signals ready via activate_lot_timer RPC
  UPDATE public.auction_lots
  SET status = 'BIDDING',
      highest_bidder_team_id = NULL,
      timer_duration_seconds = v_timer_sec,
      timer_expires_at = NULL
  WHERE id = v_first_lot_id;

  -- Update auction row to IN_PROGRESS & reset current_lot_index to 0
  UPDATE public.auctions
  SET status = 'IN_PROGRESS',
      current_lot_index = 0,
      current_lot_id = v_first_lot_id,
      total_lots = COALESCE(NULLIF(v_total_lots_inserted, 0), v_existing_lots),
      started_at = clock_timestamp()
  WHERE id = v_auction.id;

  -- Update room status to LOCKED
  UPDATE public.rooms
  SET status = 'LOCKED',
      updated_at = NOW()
  WHERE id = p_room_id;

  RETURN public.get_authoritative_auction_state(p_room_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.initialize_and_start_auction(UUID, UUID) TO authenticated, service_role, anon;

-- 5. Update advance_lot for two-phase start (timer_expires_at = NULL for next lot until activate_lot_timer is called)
CREATE OR REPLACE FUNCTION public.advance_lot(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_next_lot RECORD;
  v_total_lots INT;
  v_seq INT;
BEGIN
  -- Level 1 Lock: auctions row
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'AUCTION_NOT_FOUND');
  END IF;

  SELECT COUNT(*) INTO v_total_lots
  FROM public.auction_lots
  WHERE auction_id = p_auction_id;

  -- Find next PENDING or UNRESOLVED lot
  SELECT al.* INTO v_next_lot
  FROM public.auction_lots al
  WHERE al.auction_id = p_auction_id
    AND al.lot_index > v_auction.current_lot_index
    AND al.status NOT IN ('SOLD', 'UNSOLD', 'SKIPPED')
  ORDER BY al.lot_index ASC
  LIMIT 1
  FOR UPDATE;

  IF v_next_lot.id IS NULL THEN
    -- All lots complete
    UPDATE public.auctions
    SET status = 'COMPLETED',
        current_lot_id = NULL,
        completed_at = clock_timestamp()
    WHERE id = p_auction_id;

    UPDATE public.rooms
    SET status = 'COMPLETED',
        updated_at = NOW()
    WHERE id = v_auction.room_id;

    v_seq := public._emit_auction_event(
      p_auction_id,
      'AUCTION_COMPLETED',
      jsonb_build_object('total_lots', v_total_lots),
      NULL
    );

    RETURN jsonb_build_object('success', true, 'status', 'AUCTION_COMPLETED');
  END IF;

  -- Prepare next lot with timer_expires_at = NULL (Two-phase timer readiness)
  UPDATE public.auction_lots
  SET status = 'BIDDING',
      highest_bidder_team_id = NULL,
      current_bid = base_price,
      timer_expires_at = NULL
  WHERE id = v_next_lot.id;

  UPDATE public.auctions
  SET current_lot_index = v_next_lot.lot_index,
      current_lot_id = v_next_lot.id
  WHERE id = p_auction_id;

  v_seq := public._emit_auction_event(
    p_auction_id,
    'LOT_ADVANCED',
    jsonb_build_object(
      'lot_id', v_next_lot.id,
      'lot_index', v_next_lot.lot_index,
      'player_id', v_next_lot.player_id
    ),
    NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'LOT_ADVANCED',
    'next_lot_id', v_next_lot.id,
    'next_lot_index', v_next_lot.lot_index
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_lot(UUID) TO authenticated, service_role, anon;

-- 6. Update process_lot_expiry to allow 1-second wall-clock skew tolerance
CREATE OR REPLACE FUNCTION public.process_lot_expiry(
  p_auction_id UUID,
  p_target_lot_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_lot RECORD;
  v_player RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_winning_team RECORD;
  v_seq INT;
  v_advance_res JSONB;
  v_is_overseas BOOLEAN := false;
BEGIN
  -- Level 1 Lock: auctions row
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'AUCTION_NOT_FOUND');
  END IF;

  IF v_auction.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('success', true, 'status', 'AUCTION_COMPLETED');
  END IF;

  -- Level 2 Lock: current active lot
  IF v_auction.current_lot_id IS NOT NULL THEN
    SELECT al.* INTO v_lot
    FROM public.auction_lots al
    WHERE al.id = v_auction.current_lot_id
    FOR UPDATE;
  END IF;

  IF v_lot.id IS NULL THEN
    SELECT al.* INTO v_lot
    FROM public.auction_lots al
    WHERE al.auction_id = p_auction_id AND al.lot_index = v_auction.current_lot_index
    FOR UPDATE;
  END IF;

  IF v_lot.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'NO_ACTIVE_LOT');
  END IF;

  -- Idempotency Guard 1: Target lot mismatch (already advanced)
  IF p_target_lot_id IS NOT NULL AND v_lot.id != p_target_lot_id THEN
    RETURN jsonb_build_object('success', true, 'status', 'ALREADY_PROCESSED', 'message', 'Target lot has already been advanced');
  END IF;

  -- Idempotency Guard 2: Lot already finalized
  IF v_lot.status IN ('SOLD', 'UNSOLD', 'SKIPPED') THEN
    RETURN jsonb_build_object('success', true, 'status', 'ALREADY_PROCESSED', 'message', 'Lot already finalized');
  END IF;

  -- Verify timer actually expired using DB wall clock with 1-second tolerance
  IF v_lot.timer_expires_at IS NOT NULL AND (v_now + INTERVAL '1 second') < v_lot.timer_expires_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'NOT_EXPIRED',
      'seconds_remaining', ceil(EXTRACT(EPOCH FROM (v_lot.timer_expires_at - v_now)))
    );
  END IF;

  -- Fetch player details for overseas check
  SELECT p.* INTO v_player FROM public.players p WHERE p.id = v_lot.player_id;
  v_is_overseas := COALESCE(v_player.is_overseas, (v_player.country IS NOT NULL AND v_player.country != 'India'));

  -- Finalize current lot: SOLD or UNSOLD
  IF v_lot.highest_bidder_team_id IS NOT NULL AND v_lot.current_bid > 0 THEN
    -- Level 3 Lock: winning team row
    SELECT t.* INTO v_winning_team
    FROM public.teams t
    WHERE t.id = v_lot.highest_bidder_team_id
    FOR UPDATE;

    IF v_winning_team.id IS NULL THEN
      RAISE EXCEPTION 'WINNING_TEAM_NOT_FOUND: Team % does not exist in auction %', v_lot.highest_bidder_team_id, p_auction_id;
    END IF;

    UPDATE public.auction_lots
    SET status = 'SOLD',
        winning_team_id = v_lot.highest_bidder_team_id,
        winning_bid = v_lot.current_bid
    WHERE id = v_lot.id;

    -- Authoritative Squad Insertion
    INSERT INTO public.squad_players (
      auction_id, team_id, player_id, lot_id, purchase_price, bought_at
    ) VALUES (
      p_auction_id, v_lot.highest_bidder_team_id, v_lot.player_id, v_lot.id, v_lot.current_bid, NOW()
    );

    -- Single Authoritative Team Accounting Update
    UPDATE public.teams
    SET purse = GREATEST(0, purse - v_lot.current_bid),
        players_bought = players_bought + 1,
        overseas_count = CASE WHEN v_is_overseas THEN overseas_count + 1 ELSE overseas_count END
    WHERE id = v_lot.highest_bidder_team_id;

    -- Emit LOT_SOLD event
    v_seq := public._emit_auction_event(
      p_auction_id,
      'LOT_SOLD',
      jsonb_build_object(
        'lot_id', v_lot.id,
        'lot_index', v_lot.lot_index,
        'winning_team_id', v_lot.highest_bidder_team_id,
        'winning_bid', v_lot.current_bid,
        'player_id', v_lot.player_id
      ),
      NULL
    );
  ELSE
    -- Finalize as UNSOLD
    UPDATE public.auction_lots
    SET status = 'UNSOLD'
    WHERE id = v_lot.id;

    v_seq := public._emit_auction_event(
      p_auction_id,
      'LOT_UNSOLD',
      jsonb_build_object(
        'lot_id', v_lot.id,
        'lot_index', v_lot.lot_index,
        'player_id', v_lot.player_id
      ),
      NULL
    );
  END IF;

  -- Delegate lot advancement to advance_lot()
  v_advance_res := public.advance_lot(p_auction_id);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'EXPIRED_AND_FINALIZED',
    'final_lot_id', v_lot.id,
    'final_status', CASE WHEN v_lot.highest_bidder_team_id IS NOT NULL THEN 'SOLD' ELSE 'UNSOLD' END,
    'advance_result', v_advance_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_lot_expiry(UUID, UUID) TO authenticated, service_role, anon;

-- 7. PRIVATE AUTHORITATIVE BID ENGINE: public._process_bid_internal
DROP FUNCTION IF EXISTS public._process_bid_internal(UUID, UUID, INT, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public._process_bid_internal(
  p_auction_id UUID,
  p_team_id UUID DEFAULT NULL,
  p_amount INT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
  p_is_bot BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_room RECORD;
  v_lot RECORD;
  v_team RECORD;
  v_player RECORD;
  v_existing_bid RECORD;
  v_get_ready_expires TIMESTAMPTZ;

  v_target_team_id UUID := p_team_id;
  v_target_amount INT := p_amount;
  v_request_id UUID := p_request_id;
  v_bid_id UUID;
  v_bid_number INT;
  v_seq INT;

  v_min_increment INT;
  v_max_squad_size INT;
  v_max_overseas INT;
  v_timer_sec INT;

  v_min_required_bid INT;
  v_is_overseas BOOLEAN := false;
  v_new_expires_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Level 1 Lock: auctions row
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_FOUND');
  END IF;

  IF v_auction.status != 'IN_PROGRESS' THEN
    RETURN jsonb_build_object('success', false, 'error', CASE v_auction.status
      WHEN 'PAUSED' THEN 'AUCTION_PAUSED'
      WHEN 'COMPLETED' THEN 'AUCTION_COMPLETED'
      ELSE 'AUCTION_NOT_ACTIVE'
    END);
  END IF;

  -- Level 2 Lock: current active auction_lot row
  IF v_auction.current_lot_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_LOT');
  END IF;

  SELECT al.* INTO v_lot
  FROM public.auction_lots al
  WHERE al.id = v_auction.current_lot_id
  FOR UPDATE;

  IF v_lot.id IS NULL OR v_lot.status NOT IN ('BIDDING', 'ACTIVE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOT_NOT_ACTIVE');
  END IF;

  -- Fetch player details
  SELECT p.* INTO v_player FROM public.players p WHERE p.id = v_lot.player_id;
  v_is_overseas := COALESCE(v_player.is_overseas, (v_player.country IS NOT NULL AND v_player.country != 'India'));

  -- Read room settings
  SELECT r.* INTO v_room FROM public.rooms r WHERE r.id = v_auction.room_id;
  v_max_squad_size := COALESCE(NULLIF((v_room.settings->>'max_squad_size')::int, 0), 25);
  v_max_overseas := COALESCE(NULLIF((v_room.settings->>'max_overseas')::int, 0), 8);
  v_timer_sec := COALESCE(v_lot.timer_duration_seconds, NULLIF((v_room.settings->>'timer_duration_seconds')::int, 0), 15);

  -- Wall-Clock Expiry Check
  IF v_lot.timer_expires_at IS NOT NULL AND v_now >= v_lot.timer_expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOT_EXPIRED');
  END IF;

  -- Calculate minimum required bid according to OFFICIAL IPL INCREMENT RULES (Lakhs)
  IF v_lot.highest_bidder_team_id IS NULL OR v_lot.current_bid = 0 THEN
    v_min_required_bid := v_lot.base_price;
  ELSE
    v_min_increment := CASE
      WHEN v_lot.current_bid <= 300 THEN 25
      WHEN v_lot.current_bid <= 600 THEN 50
      WHEN v_lot.current_bid <= 1000 THEN 75
      WHEN v_lot.current_bid <= 1500 THEN 100
      WHEN v_lot.current_bid <= 2000 THEN 150
      WHEN v_lot.current_bid <= 2500 THEN 175
      ELSE 200
    END;
    v_min_required_bid := v_lot.current_bid + v_min_increment;
  END IF;

  -- AUTHORITATIVE BOT SELECTION & BOT IDEMPOTENCY (Via bot_lot_state)
  IF p_is_bot AND v_target_team_id IS NULL THEN
    SELECT bls.team_id INTO v_target_team_id
    FROM public.bot_lot_state bls
    JOIN public.teams t ON t.id = bls.team_id
    WHERE bls.lot_id = v_lot.id
      AND bls.is_interested = true
      AND bls.has_bid_current_price = false
      AND (v_lot.highest_bidder_team_id IS NULL OR t.id != v_lot.highest_bidder_team_id)
      AND bls.max_per_player_budget >= v_min_required_bid
      AND t.purse >= v_min_required_bid
      AND t.players_bought < v_max_squad_size
      AND (NOT v_is_overseas OR t.overseas_count < v_max_overseas)
      AND (bls.next_bid_eligible_at IS NULL OR v_now >= bls.next_bid_eligible_at)
    ORDER BY t.id ASC
    LIMIT 1;

    IF v_target_team_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'NO_ELIGIBLE_BOTS');
    END IF;

    v_target_amount := v_min_required_bid;

    -- Deterministic bot request_id via uuid_generate_v5
    v_request_id := uuid_generate_v5(
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
      v_lot.id::text || ':' || v_target_team_id::text || ':' || v_target_amount::text
    );
  END IF;

  -- HUMAN IDEMPOTENCY CHECK
  IF v_request_id IS NOT NULL THEN
    SELECT b.*, ae.sequence, (ae.payload->>'timer_expires_at')::timestamptz AS timer_expires_at
    INTO v_existing_bid
    FROM public.bids b
    LEFT JOIN public.auction_events ae
      ON ae.auction_id = b.auction_id
     AND (ae.payload->>'bid_id')::uuid = b.id
    WHERE b.request_id = v_request_id;

    IF v_existing_bid.id IS NOT NULL THEN
      IF v_existing_bid.auction_id != p_auction_id
         OR v_existing_bid.team_id != v_target_team_id
         OR v_existing_bid.amount != v_target_amount THEN
        RAISE EXCEPTION 'IDEMPOTENCY_PARAMETER_MISMATCH: request_id % was previously submitted with different parameters', v_request_id;
      END IF;

      RETURN jsonb_build_object(
        'success', v_existing_bid.is_valid,
        'is_duplicate', true,
        'bid_id', v_existing_bid.id,
        'auction_id', v_existing_bid.auction_id,
        'lot_id', v_existing_bid.lot_id,
        'team_id', v_existing_bid.team_id,
        'amount', v_existing_bid.amount,
        'highest_bidder_team_id', v_existing_bid.team_id,
        'timer_expires_at', v_existing_bid.timer_expires_at,
        'sequence', v_existing_bid.sequence,
        'request_id', v_existing_bid.request_id
      );
    END IF;
  ELSE
    v_request_id := gen_random_uuid();
  END IF;

  -- Level 3 Lock: bidding team row
  SELECT t.* INTO v_team
  FROM public.teams t
  WHERE t.id = v_target_team_id AND t.auction_id = p_auction_id
  FOR UPDATE;

  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEAM_NOT_FOUND');
  END IF;

  -- Outbid Lock: Cannot bid against oneself
  IF v_lot.highest_bidder_team_id = v_target_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_HIGHEST_BIDDER');
  END IF;

  -- Bid Amount Check
  IF v_target_amount IS NULL OR v_target_amount < v_min_required_bid THEN
    RETURN jsonb_build_object('success', false, 'error', 'BID_TOO_LOW', 'min_required', v_min_required_bid);
  END IF;

  -- Squad Size Check
  IF v_team.players_bought >= v_max_squad_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'BID_SQUAD_FULL');
  END IF;

  -- Overseas Count Check
  IF v_is_overseas AND v_team.overseas_count >= v_max_overseas THEN
    RETURN jsonb_build_object('success', false, 'error', 'BID_OVERSEAS_LIMIT');
  END IF;

  -- Purse Check
  IF v_target_amount > v_team.purse THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_PURSE', 'purse', v_team.purse, 'required', v_target_amount);
  END IF;

  -- Calculate next bid number
  SELECT COALESCE(MAX(bid_number), 0) + 1 INTO v_bid_number
  FROM public.bids
  WHERE lot_id = v_lot.id;

  -- Reset lot timer atomically from DB clock
  v_new_expires_at := clock_timestamp() + (v_timer_sec * INTERVAL '1 second');

  -- Insert bid record
  INSERT INTO public.bids (
    auction_id, lot_id, team_id, amount, request_id, is_bot, is_valid, rejection_reason, bid_number, created_at
  ) VALUES (
    p_auction_id, v_lot.id, v_target_team_id, v_target_amount, v_request_id, p_is_bot, true, NULL, v_bid_number, NOW()
  ) RETURNING id INTO v_bid_id;

  -- Update lot state
  UPDATE public.auction_lots
  SET current_bid = v_target_amount,
      highest_bidder_team_id = v_target_team_id,
      timer_expires_at = v_new_expires_at
  WHERE id = v_lot.id;

  -- Update bot_lot_state for interested bots
  UPDATE public.bot_lot_state
  SET has_bid_current_price = (team_id = v_target_team_id),
      next_bid_eligible_at = CASE WHEN team_id = v_target_team_id THEN clock_timestamp() + INTERVAL '2 seconds' ELSE next_bid_eligible_at END,
      updated_at = NOW()
  WHERE lot_id = v_lot.id;

  -- Emit BID_PLACED event
  v_seq := public._emit_auction_event(
    p_auction_id,
    'BID_PLACED',
    jsonb_build_object(
      'bid_id', v_bid_id,
      'lot_id', v_lot.id,
      'team_id', v_target_team_id,
      'amount', v_target_amount,
      'bid_number', v_bid_number,
      'is_bot', p_is_bot,
      'timer_expires_at', v_new_expires_at,
      'request_id', v_request_id
    ),
    CASE WHEN p_is_bot THEN NULL ELSE auth.uid() END
  );

  RETURN jsonb_build_object(
    'success', true,
    'bid_id', v_bid_id,
    'auction_id', p_auction_id,
    'lot_id', v_lot.id,
    'team_id', v_target_team_id,
    'amount', v_target_amount,
    'highest_bidder_team_id', v_target_team_id,
    'timer_expires_at', v_new_expires_at,
    'sequence', v_seq,
    'request_id', v_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public._process_bid_internal(UUID, UUID, INT, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._process_bid_internal(UUID, UUID, INT, UUID, BOOLEAN) TO service_role;

-- 8. PUBLIC HUMAN BIDDING ENDPOINT: public.process_bid
CREATE OR REPLACE FUNCTION public.process_bid(
  p_auction_id UUID,
  p_team_id UUID,
  p_amount INT,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public._process_bid_internal(p_auction_id, p_team_id, p_amount, COALESCE(p_request_id, gen_random_uuid()), false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_bid(UUID, UUID, INT, UUID) TO authenticated, service_role, anon;
