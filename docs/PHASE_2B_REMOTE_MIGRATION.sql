-- ============================================================
-- MEGA AUCTION V1 — COMBINED MIGRATION SCRIPT (PHASE 2B)
-- Generated: 2026-08-11
-- Target Database: PostgreSQL 15+ (Supabase)
-- 
-- Includes:
-- 00001_core_tables.sql  (Core V1 Entities)
-- 00002_auction_tables.sql (Auction Session Entities & Constraints)
-- 00003_indexes.sql        (22 Custom B-Tree Indexes)
-- 00004_triggers.sql       (Automatic Profile & Timestamp Triggers)
-- 00005_rls_policies.sql   (RLS Policies & is_room_participant Helper)
-- 00006_auction_rpcs.sql   (Authoritative RPCs, Unsold Round, Event Helper)
-- ============================================================

BEGIN;

-- ============================================================
-- MIGRATION FILE: 00001_core_tables.sql
-- ============================================================
-- Migration: 00001_core_tables.sql
-- Description: Core entity tables for Mega Auction V1 (Profiles, Rooms, Player Sets, Players, Room Participants)

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ROOMS
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED', 'COMPLETED', 'CANCELLED')),
  settings JSONB NOT NULL DEFAULT '{
    "timer_duration_seconds": 15,
    "min_bid_increment": 5,
    "default_purse": 1000,
    "max_squad_size": 25,
    "max_overseas": 8,
    "player_set_id": null,
    "player_order": "CATEGORY"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PLAYER SETS
CREATE TABLE IF NOT EXISTS public.player_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PLAYERS
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_set_id UUID NOT NULL REFERENCES public.player_sets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER')),
  category TEXT NOT NULL DEFAULT 'C' CHECK (category IN ('MARQUEE', 'A', 'B', 'C', 'D')),
  base_price INT NOT NULL CHECK (base_price >= 1),
  is_overseas BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ROOM PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID, -- FK to teams created in 00002
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('HOST', 'MEMBER', 'SPECTATOR')),
  is_bot BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_room_user UNIQUE(room_id, user_id)
);


-- ============================================================
-- MIGRATION FILE: 00002_auction_tables.sql
-- ============================================================
-- Migration: 00002_auction_tables.sql
-- Description: Auction session entity tables for Mega Auction V1 (Auctions, Teams, Lots, Squad Players, Bids, Events, Bot State)

-- 1. AUCTIONS
CREATE TABLE IF NOT EXISTS public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL UNIQUE REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_set_id UUID NOT NULL REFERENCES public.player_sets(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY','READY','STARTING','IN_PROGRESS','PAUSED','COMPLETED','CANCELLED')),
  current_lot_id UUID, -- FK added after auction_lots
  current_lot_index INT NOT NULL DEFAULT 0,
  total_lots INT NOT NULL DEFAULT 0,
  current_sequence INT NOT NULL DEFAULT 0,
  is_unsold_round BOOLEAN NOT NULL DEFAULT false,
  paused_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  paused_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name VARCHAR(5) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#000000',
  purse INT NOT NULL CHECK (purse >= 0),
  initial_purse INT NOT NULL CHECK (initial_purse >= 0),
  players_bought INT NOT NULL DEFAULT 0 CHECK (players_bought >= 0),
  overseas_count INT NOT NULL DEFAULT 0 CHECK (overseas_count >= 0),
  is_bot BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_auction_team_name UNIQUE(auction_id, name)
);

-- Add deferred FK to room_participants now that teams exists
ALTER TABLE public.room_participants 
  ADD CONSTRAINT fk_room_participants_team 
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3. AUCTION LOTS
CREATE TABLE IF NOT EXISTS public.auction_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  lot_index INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','BIDDING','SOLD','UNSOLD','SKIPPED')),
  base_price INT NOT NULL CHECK (base_price >= 1),
  current_bid INT NOT NULL DEFAULT 0,
  highest_bidder_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  winning_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  winning_bid INT,
  timer_duration_seconds INT NOT NULL DEFAULT 15,
  timer_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_auction_lot_index UNIQUE(auction_id, lot_index)
);

-- Add deferred FK to auctions.current_lot_id
ALTER TABLE public.auctions 
  ADD CONSTRAINT fk_auctions_current_lot 
  FOREIGN KEY (current_lot_id) REFERENCES public.auction_lots(id) ON DELETE SET NULL;

-- 4. SQUAD PLAYERS
CREATE TABLE IF NOT EXISTS public.squad_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  lot_id UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  purchase_price INT NOT NULL CHECK (purchase_price >= 1),
  bought_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_auction_player UNIQUE(auction_id, player_id)
);

-- 5. BIDS
CREATE TABLE IF NOT EXISTS public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount >= 1),
  request_id UUID NOT NULL UNIQUE,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  rejection_reason TEXT,
  bid_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. AUCTION EVENTS
CREATE TABLE IF NOT EXISTS public.auction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_auction_sequence UNIQUE(auction_id, sequence)
);

-- 7. BOT LOT STATE
CREATE TABLE IF NOT EXISTS public.bot_lot_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  is_interested BOOLEAN NOT NULL DEFAULT true,
  max_per_player_budget INT NOT NULL,
  has_bid_current_price BOOLEAN NOT NULL DEFAULT false,
  next_bid_eligible_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_bot_lot_team UNIQUE(lot_id, team_id)
);


-- ============================================================
-- MIGRATION FILE: 00003_indexes.sql
-- ============================================================
-- Migration: 00003_indexes.sql
-- Description: Performance indexes for high-frequency query paths in Mega Auction V1

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_host ON public.rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- Room participants indexes
CREATE INDEX IF NOT EXISTS idx_room_participants_room_user ON public.room_participants(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_team ON public.room_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_last_seen ON public.room_participants(last_seen_at);

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_set ON public.players(player_set_id);
CREATE INDEX IF NOT EXISTS idx_players_role ON public.players(role);
CREATE INDEX IF NOT EXISTS idx_players_category ON public.players(category);

-- Auctions indexes
CREATE INDEX IF NOT EXISTS idx_auctions_room ON public.auctions(room_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON public.auctions(status);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_auction ON public.teams(auction_id);

-- Auction lots indexes
CREATE INDEX IF NOT EXISTS idx_auction_lots_auction ON public.auction_lots(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_lots_status ON public.auction_lots(status);
CREATE INDEX IF NOT EXISTS idx_auction_lots_timer_expires ON public.auction_lots(timer_expires_at) WHERE status = 'BIDDING';

-- Squad players indexes
CREATE INDEX IF NOT EXISTS idx_squad_players_team ON public.squad_players(team_id);
CREATE INDEX IF NOT EXISTS idx_squad_players_auction ON public.squad_players(auction_id);

-- Bids indexes
CREATE INDEX IF NOT EXISTS idx_bids_lot ON public.bids(lot_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON public.bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_team ON public.bids(team_id);

-- Auction events indexes
CREATE INDEX IF NOT EXISTS idx_auction_events_seq ON public.auction_events(auction_id, sequence);

-- Bot lot state indexes
CREATE INDEX IF NOT EXISTS idx_bot_lot_state_eligible ON public.bot_lot_state(next_bid_eligible_at) WHERE is_interested = true AND has_bid_current_price = false;


-- ============================================================
-- MIGRATION FILE: 00004_triggers.sql
-- ============================================================
-- Migration: 00004_triggers.sql
-- Description: Automated triggers for profile creation and updated_at timestamp maintenance

-- 1. Automatic updated_at Function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trigger_set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_set_updated_at_rooms
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_set_updated_at_player_sets
  BEFORE UPDATE ON public.player_sets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_set_updated_at_bot_lot_state
  BEFORE UPDATE ON public.bot_lot_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Automatic Profile Creation Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- MIGRATION FILE: 00005_rls_policies.sql
-- ============================================================
-- Migration: 00005_rls_policies.sql
-- Description: Row Level Security (RLS) policies for all Mega Auction V1 tables

-- Enable RLS on all 12 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_lot_state ENABLE ROW LEVEL SECURITY;

-- Helper Function for RLS room membership checks (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_room_participant(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_participant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_room_participant(UUID, UUID) TO authenticated, service_role;

-- 1. PROFILES POLICIES
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. ROOMS POLICIES
CREATE POLICY "Rooms viewable by authenticated users" ON public.rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update room settings" ON public.rooms
  FOR UPDATE USING (auth.uid() = host_id AND status = 'OPEN');

-- 3. ROOM PARTICIPANTS POLICIES
CREATE POLICY "Room participants viewable by room members" ON public.room_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_room_participant(room_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_participants.room_id AND r.host_id = auth.uid()
    )
  );

CREATE POLICY "Users can join rooms" ON public.room_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id OR is_bot = true);

CREATE POLICY "Host can manage room participants" ON public.room_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_participants.room_id AND r.host_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

-- 4. PLAYER SETS POLICIES
CREATE POLICY "Public or owned player sets viewable" ON public.player_sets
  FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create player sets" ON public.player_sets
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner can update player sets" ON public.player_sets
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Owner can delete player sets" ON public.player_sets
  FOR DELETE USING (created_by = auth.uid());

-- 5. PLAYERS POLICIES
CREATE POLICY "Players viewable via player set" ON public.players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.player_sets ps
      WHERE ps.id = players.player_set_id AND (ps.is_public = true OR ps.created_by = auth.uid())
    )
  );

CREATE POLICY "Player set owner can modify players" ON public.players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.player_sets ps
      WHERE ps.id = players.player_set_id AND ps.created_by = auth.uid()
    )
  );

-- 6. AUCTIONS POLICIES
CREATE POLICY "Auctions viewable by room participants" ON public.auctions
  FOR SELECT USING (
    public.is_room_participant(auctions.room_id, auth.uid())
  );

CREATE POLICY "Host can create auction" ON public.auctions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = auctions.room_id AND r.host_id = auth.uid()
    )
  );

-- 7. TEAMS POLICIES
CREATE POLICY "Teams viewable by room participants" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = teams.auction_id AND public.is_room_participant(a.room_id, auth.uid())
    )
  );

-- 8. AUCTION LOTS POLICIES
CREATE POLICY "Auction lots viewable by room participants" ON public.auction_lots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = auction_lots.auction_id AND public.is_room_participant(a.room_id, auth.uid())
    )
  );

-- 9. SQUAD PLAYERS POLICIES
CREATE POLICY "Squad players viewable by room participants" ON public.squad_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = squad_players.auction_id AND public.is_room_participant(a.room_id, auth.uid())
    )
  );

-- 10. BIDS POLICIES
CREATE POLICY "Bids viewable by room participants" ON public.bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = bids.auction_id AND public.is_room_participant(a.room_id, auth.uid())
    )
  );

-- 11. AUCTION EVENTS POLICIES
CREATE POLICY "Auction events viewable by room participants" ON public.auction_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = auction_events.auction_id AND public.is_room_participant(a.room_id, auth.uid())
    )
  );

-- 12. BOT LOT STATE POLICIES
CREATE POLICY "Bot state viewable by room participants" ON public.bot_lot_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auction_lots al
      JOIN public.auctions a ON a.id = al.auction_id
      WHERE al.id = bot_lot_state.lot_id AND public.is_room_participant(a.room_id, auth.uid())
    )
  );


-- ============================================================
-- MIGRATION FILE: 00006_auction_rpcs.sql
-- ============================================================
-- Migration: 00006_auction_rpcs.sql
-- Description: Authoritative Database Functions (RPCs) & Core Auction Logic for Mega Auction V1
-- Phase: 2B
-- Target Database: PostgreSQL 15+ (Supabase)

-- ============================================================
-- 1. PRIVATE EVENT HELPER: public._emit_auction_event
-- ============================================================
-- Atomic sequence increment and event store insertion
CREATE OR REPLACE FUNCTION public._emit_auction_event(
  p_auction_id UUID,
  p_event_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_actor_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_sequence INT;
BEGIN
  -- Increment sequence atomically on Level 1 locked auctions row
  UPDATE public.auctions
  SET current_sequence = current_sequence + 1
  WHERE id = p_auction_id
  RETURNING current_sequence INTO v_next_sequence;

  IF v_next_sequence IS NULL THEN
    RAISE EXCEPTION 'AUCTION_NOT_FOUND: Auction % does not exist', p_auction_id;
  END IF;

  -- Insert into auction_events within the caller's transaction
  INSERT INTO public.auction_events (auction_id, sequence, event_type, payload, actor_id)
  VALUES (p_auction_id, v_next_sequence, p_event_type, p_payload, p_actor_id);

  RETURN v_next_sequence;
END;
$$;

REVOKE ALL ON FUNCTION public._emit_auction_event(UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._emit_auction_event(UUID, TEXT, JSONB, UUID) TO service_role;


-- ============================================================
-- 2. PRIVATE BOT EVALUATION HELPER: public.evaluate_bot_interests
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_bot_interests(
  p_auction_id UUID,
  p_lot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot RECORD;
  v_player RECORD;
  v_team RECORD;
  v_count INT := 0;
  v_budget INT;
  v_multiplier NUMERIC;
BEGIN
  -- Lock auction lot
  SELECT al.* INTO v_lot
  FROM public.auction_lots al
  WHERE al.id = p_lot_id AND al.auction_id = p_auction_id;

  IF v_lot.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOT_NOT_FOUND');
  END IF;

  -- Fetch player details
  SELECT p.* INTO v_player
  FROM public.players p
  WHERE p.id = v_lot.player_id;

  -- Category budget multipliers
  v_multiplier := CASE v_player.category
    WHEN 'MARQUEE' THEN 0.35
    WHEN 'A' THEN 0.25
    WHEN 'B' THEN 0.18
    WHEN 'C' THEN 0.12
    ELSE 0.08
  END;

  -- Loop through all bot teams in this auction ordered by id
  FOR v_team IN
    SELECT t.* FROM public.teams t
    WHERE t.auction_id = p_auction_id AND t.is_bot = true
    ORDER BY t.id ASC
  LOOP
    -- Calculate max budget ceiling for this player
    v_budget := GREATEST(v_lot.base_price, FLOOR(v_team.initial_purse * v_multiplier));
    v_budget := LEAST(v_budget, v_team.purse);

    INSERT INTO public.bot_lot_state (
      lot_id, team_id, is_interested, max_per_player_budget, has_bid_current_price, updated_at
    )
    VALUES (
      p_lot_id, v_team.id, (v_budget >= v_lot.base_price), v_budget, false, NOW()
    )
    ON CONFLICT (lot_id, team_id) DO UPDATE SET
      max_per_player_budget = EXCLUDED.max_per_player_budget,
      is_interested = EXCLUDED.is_interested,
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'evaluated_bots', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_bot_interests(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_bot_interests(UUID, UUID) TO service_role;


-- ============================================================
-- 3. PRIVATE INTERNAL LOT ADVANCEMENT: public.advance_lot
-- ============================================================
-- Manages lot sequence transitions & Issue #6 Clone-on-Transition Unsold Round
CREATE OR REPLACE FUNCTION public.advance_lot(
  p_auction_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_room RECORD;
  v_next_lot RECORD;
  v_unsold_lot RECORD;
  v_new_lot_id UUID;
  v_new_lot_index INT;
  v_cloned_count INT := 0;
  v_timer_sec INT;
  v_seq INT;
  v_eval_res JSONB;
BEGIN
  -- Level 1 Lock: auctions row
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_FOUND');
  END IF;

  -- Read room settings for timer duration
  SELECT r.* INTO v_room FROM public.rooms r WHERE r.id = v_auction.room_id;
  v_timer_sec := COALESCE(NULLIF((v_room.settings->>'timer_duration_seconds')::int, 0), 15);

  v_next_lot_index := v_auction.current_lot_index + 1;

  -- Check if next lot exists in current lot sequence
  SELECT al.* INTO v_next_lot
  FROM public.auction_lots al
  WHERE al.auction_id = p_auction_id AND al.lot_index = v_next_lot_index;

  IF v_next_lot.id IS NOT NULL THEN
    -- Next lot exists: activate it
    UPDATE public.auctions
    SET current_lot_index = v_next_lot_index,
        current_lot_id = v_next_lot.id
    WHERE id = p_auction_id;

    UPDATE public.auction_lots
    SET status = 'BIDDING',
        timer_expires_at = clock_timestamp() + (v_timer_sec * INTERVAL '1 second')
    WHERE id = v_next_lot.id;

    -- Evaluate bot interests for new lot
    v_eval_res := public.evaluate_bot_interests(p_auction_id, v_next_lot.id);

    -- Emit LOT_STARTED event
    v_seq := public._emit_auction_event(
      p_auction_id,
      'LOT_STARTED',
      jsonb_build_object(
        'lot_id', v_next_lot.id,
        'lot_index', v_next_lot_index,
        'player_id', v_next_lot.player_id,
        'base_price', v_next_lot.base_price,
        'timer_expires_at', (clock_timestamp() + (v_timer_sec * INTERVAL '1 second')),
        'is_unsold_round', v_auction.is_unsold_round
      ),
      NULL
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'LOT_STARTED',
      'current_lot_id', v_next_lot.id,
      'current_lot_index', v_next_lot_index,
      'is_unsold_round', v_auction.is_unsold_round,
      'sequence', v_seq
    );
  END IF;

  -- Current round lots exhausted.
  -- ISSUE #6: CLONE-ON-TRANSITION UNSOLD ROUND LOGIC
  IF NOT v_auction.is_unsold_round THEN
    -- Check for unsold lots from Round 1
    v_new_lot_index := v_auction.total_lots;

    FOR v_unsold_lot IN
      SELECT al.* FROM public.auction_lots al
      WHERE al.auction_id = p_auction_id AND al.status = 'UNSOLD'
      ORDER BY al.lot_index ASC
    LOOP
      v_new_lot_id := gen_random_uuid();
      
      -- Clone UNSOLD lot as a NEW row in auction_lots
      -- Round 2 base_price = GREATEST(1, FLOOR(original_base_price * 0.5))
      INSERT INTO public.auction_lots (
        id, auction_id, player_id, lot_index, status, base_price,
        current_bid, timer_duration_seconds, created_at
      ) VALUES (
        v_new_lot_id,
        p_auction_id,
        v_unsold_lot.player_id,
        v_new_lot_index,
        'PENDING',
        GREATEST(1, FLOOR(v_unsold_lot.base_price * 0.5)),
        0,
        v_unsold_lot.timer_duration_seconds,
        NOW()
      );

      v_new_lot_index := v_new_lot_index + 1;
      v_cloned_count := v_cloned_count + 1;
    END LOOP;

    IF v_cloned_count > 0 THEN
      -- Unsold Round 2 initialized with cloned lots
      UPDATE public.auctions
      SET is_unsold_round = true,
          total_lots = v_auction.total_lots + v_cloned_count
      WHERE id = p_auction_id;

      -- Emit UNSOLD_ROUND_STARTED event
      v_seq := public._emit_auction_event(
        p_auction_id,
        'UNSOLD_ROUND_STARTED',
        jsonb_build_object('cloned_lots_count', v_cloned_count),
        NULL
      );

      -- Recursively activate the first cloned lot of Round 2
      RETURN public.advance_lot(p_auction_id);
    END IF;
  END IF;

  -- No unsold lots or Round 2 completed: COMPLETE AUCTION
  UPDATE public.auctions
  SET status = 'COMPLETED',
      completed_at = clock_timestamp(),
      current_lot_id = NULL
  WHERE id = p_auction_id;

  v_seq := public._emit_auction_event(
    p_auction_id,
    'AUCTION_COMPLETED',
    jsonb_build_object('completed_at', clock_timestamp()),
    NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'COMPLETED',
    'completed_at', clock_timestamp(),
    'sequence', v_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION public.advance_lot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_lot(UUID) TO service_role;


-- ============================================================
-- 4. PRIVATE AUTHORITATIVE CORE PIPELINE: public._process_bid_internal
-- ============================================================
-- Single authoritative bid validation & state mutation engine
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
  v_bot_state RECORD;

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
  v_remaining_slots INT;
  v_min_pending_base_price INT;
  v_mandatory_reserve INT;
  v_max_allowed_bid INT;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  -- LEVEL 1 LOCK: auctions row
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_FOUND');
  END IF;

  -- 1. HUMAN IDEMPOTENCY CHECK (Post Level-1 lock, before normal auction/lot validation)
  IF NOT p_is_bot AND v_request_id IS NOT NULL THEN
    SELECT b.*, ae.sequence, (ae.payload->>'timer_expires_at')::timestamptz AS timer_expires_at
    INTO v_existing_bid
    FROM public.bids b
    LEFT JOIN public.auction_events ae 
      ON ae.auction_id = b.auction_id 
     AND (ae.payload->>'bid_id')::uuid = b.id
    WHERE b.request_id = v_request_id;

    IF v_existing_bid.id IS NOT NULL THEN
      -- Parameter Conflict Check
      IF v_existing_bid.auction_id != p_auction_id 
         OR v_existing_bid.team_id != v_target_team_id 
         OR v_existing_bid.amount != v_target_amount THEN
        RAISE EXCEPTION 'IDEMPOTENCY_PARAMETER_MISMATCH: request_id % was previously submitted with different parameters', v_request_id;
      END IF;

      -- Return original bid response with is_duplicate = true (ZERO side-effects)
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
  END IF;

  -- Normal auction status validation
  IF v_auction.status != 'IN_PROGRESS' THEN
    RETURN jsonb_build_object('success', false, 'error', CASE v_auction.status
      WHEN 'PAUSED' THEN 'AUCTION_PAUSED'
      WHEN 'COMPLETED' THEN 'AUCTION_COMPLETED'
      ELSE 'AUCTION_NOT_ACTIVE'
    END);
  END IF;

  -- LEVEL 2 LOCK: current active auction_lot row
  IF v_auction.current_lot_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_LOT');
  END IF;

  SELECT al.* INTO v_lot
  FROM public.auction_lots al
  WHERE al.id = v_auction.current_lot_id
  FOR UPDATE;

  IF v_lot.id IS NULL OR v_lot.status != 'BIDDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOT_NOT_ACTIVE');
  END IF;

  -- Wall-Clock Expiry Check
  IF clock_timestamp() >= v_lot.timer_expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOT_EXPIRED');
  END IF;

  -- Read room settings with safe fallbacks
  SELECT r.* INTO v_room FROM public.rooms r WHERE r.id = v_auction.room_id;
  v_min_increment := COALESCE(NULLIF((v_room.settings->>'min_bid_increment')::int, 0), 5);
  v_max_squad_size := COALESCE(NULLIF((v_room.settings->>'max_squad_size')::int, 0), 25);
  v_max_overseas := COALESCE(NULLIF((v_room.settings->>'max_overseas')::int, 0), 8);
  v_timer_sec := COALESCE(NULLIF((v_room.settings->>'timer_duration_seconds')::int, 0), 15);

  -- 2. BOT CANDIDATE SELECTION & BOT IDEMPOTENCY (Post-Lock Fresh State)
  IF p_is_bot AND v_target_team_id IS NULL THEN
    -- Calculate minimum required bid amount from locked lot
    v_min_required_bid := CASE WHEN v_lot.current_bid = 0 THEN v_lot.base_price ELSE v_lot.current_bid + v_min_increment END;

    -- Select top eligible bot team for this lot
    SELECT bls.team_id INTO v_target_team_id
    FROM public.bot_lot_state bls
    JOIN public.teams t ON t.id = bls.team_id
    WHERE bls.lot_id = v_lot.id
      AND bls.is_interested = true
      AND bls.has_bid_current_price = false
      AND bls.max_per_player_budget >= v_min_required_bid
      AND t.purse >= v_min_required_bid
      AND t.players_bought < v_max_squad_size
      AND (bls.next_bid_eligible_at IS NULL OR clock_timestamp() >= bls.next_bid_eligible_at)
    ORDER BY t.id ASC
    LIMIT 1;

    IF v_target_team_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'NO_ELIGIBLE_BOTS');
    END IF;

    v_target_amount := v_min_required_bid;

    -- Generate deterministic bot request_id using uuid_generate_v5
    v_request_id := uuid_generate_v5(
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
      v_lot.id::text || ':' || v_target_team_id::text || ':' || v_target_amount::text
    );

    -- Check bot request_id idempotency before performing any mutation
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
  END IF;

  -- Ensure request_id exists for humans if p_request_id was NULL
  IF v_request_id IS NULL THEN
    v_request_id := gen_random_uuid();
  END IF;

  -- LEVEL 3 LOCK: bidding team row
  SELECT t.* INTO v_team
  FROM public.teams t
  WHERE t.id = v_target_team_id AND t.auction_id = p_auction_id
  FOR UPDATE;

  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEAM_NOT_FOUND');
  END IF;

  -- Fetch player details
  SELECT p.* INTO v_player FROM public.players p WHERE p.id = v_lot.player_id;

  -- Validation Checks
  v_min_required_bid := CASE WHEN v_lot.current_bid = 0 THEN v_lot.base_price ELSE v_lot.current_bid + v_min_increment END;
  IF v_target_amount < v_min_required_bid THEN
    RETURN jsonb_build_object('success', false, 'error', 'BID_TOO_LOW', 'min_required', v_min_required_bid);
  END IF;

  IF v_team.players_bought >= v_max_squad_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'BID_SQUAD_FULL');
  END IF;

  IF v_player.is_overseas AND v_team.overseas_count >= v_max_overseas THEN
    RETURN jsonb_build_object('success', false, 'error', 'BID_OVERSEAS_LIMIT');
  END IF;

  -- Mandatory Reserve Calculation (SRS 2.3)
  v_remaining_slots := v_max_squad_size - v_team.players_bought - 1;
  IF v_remaining_slots > 0 THEN
    SELECT COALESCE(MIN(base_price), 1) INTO v_min_pending_base_price
    FROM public.auction_lots
    WHERE auction_id = p_auction_id AND status = 'PENDING';

    v_mandatory_reserve := v_remaining_slots * COALESCE(v_min_pending_base_price, 1);
  ELSE
    v_mandatory_reserve := 0;
  END IF;

  v_max_allowed_bid := v_team.purse - v_mandatory_reserve;
  IF v_target_amount > v_max_allowed_bid THEN
    RETURN jsonb_build_object('success', false, 'error', 'BID_EXCEEDS_RESERVE_CAP', 'max_allowed', v_max_allowed_bid);
  END IF;

  -- Calculate next sequence bid number
  SELECT COALESCE(MAX(bid_number), 0) + 1 INTO v_bid_number
  FROM public.bids
  WHERE lot_id = v_lot.id;

  -- Reset lot timer atomically
  v_new_expires_at := clock_timestamp() + (v_timer_sec * INTERVAL '1 second');

  -- 3. INSERT BID WITH RACE BACKSTOP
  BEGIN
    INSERT INTO public.bids (
      auction_id, lot_id, team_id, amount, request_id, is_bot, is_valid, rejection_reason, bid_number, created_at
    ) VALUES (
      p_auction_id, v_lot.id, v_target_team_id, v_target_amount, v_request_id, p_is_bot, true, NULL, v_bid_number, NOW()
    ) RETURNING id INTO v_bid_id;
  EXCEPTION WHEN unique_violation THEN
    -- Race Backstop: Retrieve existing bid
    SELECT b.*, ae.sequence, (ae.payload->>'timer_expires_at')::timestamptz AS timer_expires_at
    INTO v_existing_bid
    FROM public.bids b
    LEFT JOIN public.auction_events ae ON ae.auction_id = b.auction_id AND (ae.payload->>'bid_id')::uuid = b.id
    WHERE b.request_id = v_request_id;

    -- Compare parameters for conflict
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
  END;

  -- UPDATE LOT STATE
  UPDATE public.auction_lots
  SET current_bid = v_target_amount,
      highest_bidder_team_id = v_target_team_id,
      timer_expires_at = v_new_expires_at
  WHERE id = v_lot.id;

  -- LEVEL 4 LOCK & UPDATE: bot_lot_state
  UPDATE public.bot_lot_state
  SET has_bid_current_price = (team_id = v_target_team_id),
      next_bid_eligible_at = CASE WHEN team_id = v_target_team_id THEN clock_timestamp() + INTERVAL '2 seconds' ELSE next_bid_eligible_at END,
      updated_at = NOW()
  WHERE lot_id = v_lot.id;

  -- EMIT EVENT VIA ISSUE #7 HELPER
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


-- ============================================================
-- 5. PUBLIC HUMAN BID RPC: public.process_bid
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_bid(
  p_auction_id UUID,
  p_team_id UUID,
  p_amount INT,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_team_id UUID;
  v_is_team_bot BOOLEAN;
BEGIN
  -- Disallow unauthenticated callers
  IF auth.role() = 'anon' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ANON: Authentication required';
  END IF;

  -- Verify caller controls p_team_id in auction room (Bypassing RLS under definer context)
  IF auth.role() = 'authenticated' THEN
    SELECT rp.team_id, t.is_bot INTO v_caller_team_id, v_is_team_bot
    FROM public.room_participants rp
    JOIN public.auctions a ON a.room_id = rp.room_id
    JOIN public.teams t ON t.id = rp.team_id
    WHERE a.id = p_auction_id
      AND rp.user_id = auth.uid()
      AND rp.team_id = p_team_id;

    IF v_caller_team_id IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED_TEAM_BID: User % does not control team % in auction %', auth.uid(), p_team_id, p_auction_id;
    END IF;

    IF v_is_team_bot = true THEN
      RAISE EXCEPTION 'UNAUTHORIZED_BOT_TEAM_BID: Human users cannot bid on behalf of bot team %', p_team_id;
    END IF;
  END IF;

  -- Delegate to internal pipeline
  RETURN public._process_bid_internal(
    p_auction_id,
    p_team_id,
    p_amount,
    p_request_id,
    false -- p_is_bot = false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_bid(UUID, UUID, INT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_bid(UUID, UUID, INT, UUID) TO authenticated, service_role;


-- ============================================================
-- 6. PUBLIC BOT EXECUTION ENDPOINT: public.execute_bot_bids
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_bot_bids(
  p_auction_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delegate directly to internal pipeline with auto bot candidate selection
  RETURN public._process_bid_internal(
    p_auction_id,
    NULL, -- p_team_id = NULL (auto select)
    NULL, -- p_amount = NULL
    NULL, -- p_request_id = NULL (auto generate)
    true  -- p_is_bot = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_bot_bids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_bot_bids(UUID) TO service_role;


-- ============================================================
-- 7. PUBLIC LOT EXPIRY RPC: public.process_lot_expiry
-- ============================================================
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
  v_seq INT;
  v_adv_res JSONB;
BEGIN
  -- Verify caller room participant privilege if authenticated
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.room_participants rp ON rp.room_id = a.room_id
      WHERE a.id = p_auction_id AND rp.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED_ROOM_ACCESS: User % is not a participant in auction %', auth.uid(), p_auction_id;
    END IF;
  END IF;

  -- LEVEL 1 LOCK: auctions row
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_FOUND');
  END IF;

  -- TARGET LOT IDEMPOTENCY GUARD
  IF p_target_lot_id IS NOT NULL AND p_target_lot_id != v_auction.current_lot_id THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_PROCESSED',
      'target_lot_id', p_target_lot_id,
      'current_lot_id', v_auction.current_lot_id
    );
  END IF;

  IF v_auction.current_lot_id IS NULL THEN
    RETURN jsonb_build_object('status', 'NO_ACTIVE_LOT');
  END IF;

  -- LEVEL 2 LOCK: current lot row
  SELECT al.* INTO v_lot
  FROM public.auction_lots al
  WHERE al.id = v_auction.current_lot_id
  FOR UPDATE;

  IF v_lot.id IS NULL OR v_lot.status != 'BIDDING' THEN
    RETURN jsonb_build_object('status', 'ALREADY_PROCESSED');
  END IF;

  -- WALL-CLOCK EXPIRY CHECK
  IF clock_timestamp() < v_lot.timer_expires_at THEN
    RETURN jsonb_build_object(
      'status', 'NOT_EXPIRED',
      'timer_expires_at', v_lot.timer_expires_at,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_lot.timer_expires_at - clock_timestamp()))
    );
  END IF;

  -- LOT EXPIRED: FINALIZE
  IF v_lot.highest_bidder_team_id IS NOT NULL THEN
    -- SOLD
    UPDATE public.auction_lots
    SET status = 'SOLD',
        winning_team_id = v_lot.highest_bidder_team_id,
        winning_bid = v_lot.current_bid
    WHERE id = v_lot.id;

    -- Fetch player overseas flag
    SELECT p.* INTO v_player FROM public.players p WHERE p.id = v_lot.player_id;

    -- Level 3 Lock & Update: winning team purse & roster
    UPDATE public.teams
    SET purse = purse - v_lot.current_bid,
        players_bought = players_bought + 1,
        overseas_count = CASE WHEN v_player.is_overseas THEN overseas_count + 1 ELSE overseas_count END
    WHERE id = v_lot.highest_bidder_team_id;

    -- Insert squad_players roster entry
    INSERT INTO public.squad_players (
      auction_id, team_id, player_id, lot_id, purchase_price, bought_at
    ) VALUES (
      p_auction_id, v_lot.highest_bidder_team_id, v_lot.player_id, v_lot.id, v_lot.current_bid, NOW()
    );

    -- Emit LOT_COMPLETED (SOLD) event via _emit_auction_event
    v_seq := public._emit_auction_event(
      p_auction_id,
      'LOT_COMPLETED',
      jsonb_build_object(
        'lot_id', v_lot.id,
        'status', 'SOLD',
        'winning_team_id', v_lot.highest_bidder_team_id,
        'winning_bid', v_lot.current_bid,
        'player_id', v_lot.player_id
      ),
      NULL
    );
  ELSE
    -- UNSOLD
    UPDATE public.auction_lots
    SET status = 'UNSOLD'
    WHERE id = v_lot.id;

    -- Emit LOT_COMPLETED (UNSOLD) event via _emit_auction_event
    v_seq := public._emit_auction_event(
      p_auction_id,
      'LOT_COMPLETED',
      jsonb_build_object(
        'lot_id', v_lot.id,
        'status', 'UNSOLD',
        'player_id', v_lot.player_id
      ),
      NULL
    );
  END IF;

  -- ADVANCE TO NEXT LOT
  v_adv_res := public.advance_lot(p_auction_id);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'EXPIRED_AND_FINALIZED',
    'lot_id', v_lot.id,
    'final_lot_status', CASE WHEN v_lot.highest_bidder_team_id IS NOT NULL THEN 'SOLD' ELSE 'UNSOLD' END,
    'sequence', v_seq,
    'advance_result', v_adv_res
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_lot_expiry(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_lot_expiry(UUID, UUID) TO authenticated, service_role;


-- ============================================================
-- 8. PUBLIC HOST RPC: public.start_auction
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_auction(
  p_auction_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_room RECORD;
  v_lot0 RECORD;
  v_timer_sec INT;
  v_seq INT;
  v_eval_res JSONB;
BEGIN
  -- Verify host permission if authenticated
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.rooms r ON r.id = a.room_id
      WHERE a.id = p_auction_id AND r.host_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED_HOST_ONLY: Only the room host can start the auction';
    END IF;
  END IF;

  -- LEVEL 1 LOCK: auctions row
  SELECT a.* INTO v_auction
  FROM public.auctions a
  WHERE a.id = p_auction_id
  FOR UPDATE;

  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_FOUND');
  END IF;

  IF v_auction.status NOT IN ('LOBBY', 'READY') THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUCTION_ALREADY_STARTED');
  END IF;

  -- Read room settings for timer duration
  SELECT r.* INTO v_room FROM public.rooms r WHERE r.id = v_auction.room_id;
  v_timer_sec := COALESCE(NULLIF((v_room.settings->>'timer_duration_seconds')::int, 0), 15);

  -- LEVEL 2 LOCK: lot 0
  SELECT al.* INTO v_lot0
  FROM public.auction_lots al
  WHERE al.auction_id = p_auction_id AND al.lot_index = 0
  FOR UPDATE;

  IF v_lot0.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOT_ZERO_NOT_FOUND');
  END IF;

  -- Transition auction & lot 0
  UPDATE public.auctions
  SET status = 'IN_PROGRESS',
      started_at = clock_timestamp(),
      current_lot_index = 0,
      current_lot_id = v_lot0.id
  WHERE id = p_auction_id;

  UPDATE public.auction_lots
  SET status = 'BIDDING',
      timer_expires_at = clock_timestamp() + (v_timer_sec * INTERVAL '1 second')
  WHERE id = v_lot0.id;

  -- Evaluate bot interests for lot 0
  v_eval_res := public.evaluate_bot_interests(p_auction_id, v_lot0.id);

  -- Emit events
  PERFORM public._emit_auction_event(p_auction_id, 'AUCTION_STARTED', jsonb_build_object('started_at', clock_timestamp()), CASE WHEN auth.role() = 'authenticated' THEN auth.uid() ELSE NULL END);
  v_seq := public._emit_auction_event(
    p_auction_id,
    'LOT_STARTED',
    jsonb_build_object(
      'lot_id', v_lot0.id,
      'lot_index', 0,
      'player_id', v_lot0.player_id,
      'base_price', v_lot0.base_price,
      'timer_expires_at', (clock_timestamp() + (v_timer_sec * INTERVAL '1 second'))
    ),
    CASE WHEN auth.role() = 'authenticated' THEN auth.uid() ELSE NULL END
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'IN_PROGRESS',
    'current_lot_id', v_lot0.id,
    'sequence', v_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_auction(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_auction(UUID) TO authenticated, service_role;


-- ============================================================
-- 9. PUBLIC HOST RPC: public.pause_auction
-- ============================================================
CREATE OR REPLACE FUNCTION public.pause_auction(
  p_auction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_lot RECORD;
  v_remaining_ms INT;
  v_seq INT;
BEGIN
  -- Verify host permission if authenticated
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.rooms r ON r.id = a.room_id
      WHERE a.id = p_auction_id AND r.host_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED_HOST_ONLY: Only room host can pause auction';
    END IF;
  END IF;

  -- LEVEL 1 LOCK: auctions row
  SELECT a.* INTO v_auction FROM public.auctions a WHERE a.id = p_auction_id FOR UPDATE;
  IF v_auction.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_FOUND'); END IF;
  IF v_auction.status != 'IN_PROGRESS' THEN RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_IN_PROGRESS'); END IF;

  -- LEVEL 2 LOCK: current active lot
  SELECT al.* INTO v_lot FROM public.auction_lots al WHERE al.id = v_auction.current_lot_id FOR UPDATE;

  -- Calculate remaining interval in milliseconds
  v_remaining_ms := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_lot.timer_expires_at - clock_timestamp())) * 1000));

  -- Encode paused_reason as structured JSON string
  UPDATE public.auctions
  SET status = 'PAUSED',
      paused_by = CASE WHEN auth.role() = 'authenticated' THEN auth.uid() ELSE NULL END,
      paused_reason = jsonb_build_object('remaining_ms', v_remaining_ms, 'reason', COALESCE(p_reason, 'Host paused auction'))::text
  WHERE id = p_auction_id;

  UPDATE public.auction_lots
  SET timer_expires_at = NULL
  WHERE id = v_lot.id;

  v_seq := public._emit_auction_event(
    p_auction_id,
    'AUCTION_PAUSED',
    jsonb_build_object('remaining_ms', v_remaining_ms, 'reason', p_reason),
    CASE WHEN auth.role() = 'authenticated' THEN auth.uid() ELSE NULL END
  );

  RETURN jsonb_build_object('success', true, 'status', 'PAUSED', 'remaining_ms', v_remaining_ms, 'sequence', v_seq);
END;
$$;

REVOKE ALL ON FUNCTION public.pause_auction(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_auction(UUID, TEXT) TO authenticated, service_role;


-- ============================================================
-- 10. PUBLIC HOST RPC: public.resume_auction
-- ============================================================
CREATE OR REPLACE FUNCTION public.resume_auction(
  p_auction_id UUID
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
  v_remaining_ms INT;
  v_new_expires_at TIMESTAMPTZ;
  v_seq INT;
BEGIN
  -- Verify host permission if authenticated
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.rooms r ON r.id = a.room_id
      WHERE a.id = p_auction_id AND r.host_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED_HOST_ONLY: Only room host can resume auction';
    END IF;
  END IF;

  -- LEVEL 1 LOCK: auctions row
  SELECT a.* INTO v_auction FROM public.auctions a WHERE a.id = p_auction_id FOR UPDATE;
  IF v_auction.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_FOUND'); END IF;
  IF v_auction.status != 'PAUSED' THEN RETURN jsonb_build_object('success', false, 'error', 'AUCTION_NOT_PAUSED'); END IF;

  -- LEVEL 2 LOCK: current active lot
  SELECT al.* INTO v_lot FROM public.auction_lots al WHERE al.id = v_auction.current_lot_id FOR UPDATE;
  SELECT r.* INTO v_room FROM public.rooms r WHERE r.id = v_auction.room_id;

  -- Safely decode remaining_ms from paused_reason JSON with robust fallbacks
  BEGIN
    v_remaining_ms := (v_auction.paused_reason::jsonb->>'remaining_ms')::int;
  EXCEPTION WHEN OTHERS THEN
    v_remaining_ms := COALESCE(NULLIF((v_room.settings->>'timer_duration_seconds')::int, 0), 15) * 1000;
  END;

  v_remaining_ms := GREATEST(1000, LEAST(COALESCE(v_remaining_ms, 15000), 60000));
  v_new_expires_at := clock_timestamp() + (v_remaining_ms * INTERVAL '1 millisecond');

  UPDATE public.auctions
  SET status = 'IN_PROGRESS',
      paused_by = NULL,
      paused_reason = NULL
  WHERE id = p_auction_id;

  UPDATE public.auction_lots
  SET timer_expires_at = v_new_expires_at
  WHERE id = v_lot.id;

  v_seq := public._emit_auction_event(
    p_auction_id,
    'AUCTION_RESUMED',
    jsonb_build_object('timer_expires_at', v_new_expires_at),
    CASE WHEN auth.role() = 'authenticated' THEN auth.uid() ELSE NULL END
  );

  RETURN jsonb_build_object('success', true, 'status', 'IN_PROGRESS', 'timer_expires_at', v_new_expires_at, 'sequence', v_seq);
END;
$$;

REVOKE ALL ON FUNCTION public.resume_auction(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_auction(UUID) TO authenticated, service_role;


COMMIT;
