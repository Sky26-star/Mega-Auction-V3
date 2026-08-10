-- ==============================================================================
-- MEGA AUCTION V1 — COMBINED PHASE 2A MIGRATION SCRIPT (CORRECTED)
-- Destination: docs/PHASE_2A_REMOTE_MIGRATION.sql
-- Description: Single combined SQL script preserving the exact SQL statements from
--              the 5 corrected Phase 2A migration files for execution in Supabase Dashboard SQL Editor.
-- ==============================================================================

-- ==============================================================================
-- MIGRATION 00001 — Core Entity Tables
-- ==============================================================================

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


-- ==============================================================================
-- MIGRATION 00002 — Auction Session Entity Tables
-- ==============================================================================

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


-- ==============================================================================
-- MIGRATION 00003 — Performance Query Indexes
-- ==============================================================================

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


-- ==============================================================================
-- MIGRATION 00004 — Triggers & Profile Maintenance
-- ==============================================================================

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


-- ==============================================================================
-- MIGRATION 00005 — Row Level Security (RLS) Policies
-- ==============================================================================

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
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = room_participants.room_id AND rp.user_id = auth.uid()
    )
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
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = auctions.room_id AND rp.user_id = auth.uid()
    )
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
      JOIN public.room_participants rp ON rp.room_id = a.room_id
      WHERE a.id = teams.auction_id AND rp.user_id = auth.uid()
    )
  );

-- 8. AUCTION LOTS POLICIES
CREATE POLICY "Auction lots viewable by room participants" ON public.auction_lots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.room_participants rp ON rp.room_id = a.room_id
      WHERE a.id = auction_lots.auction_id AND rp.user_id = auth.uid()
    )
  );

-- 9. SQUAD PLAYERS POLICIES
CREATE POLICY "Squad players viewable by room participants" ON public.squad_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.room_participants rp ON rp.room_id = a.room_id
      WHERE a.id = squad_players.auction_id AND rp.user_id = auth.uid()
    )
  );

-- 10. BIDS POLICIES
CREATE POLICY "Bids viewable by room participants" ON public.bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.room_participants rp ON rp.room_id = a.room_id
      WHERE a.id = bids.auction_id AND rp.user_id = auth.uid()
    )
  );

-- 11. AUCTION EVENTS POLICIES
CREATE POLICY "Auction events viewable by room participants" ON public.auction_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.room_participants rp ON rp.room_id = a.room_id
      WHERE a.id = auction_events.auction_id AND rp.user_id = auth.uid()
    )
  );

-- 12. BOT LOT STATE POLICIES
CREATE POLICY "Bot state viewable by room participants" ON public.bot_lot_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auction_lots al
      JOIN public.auctions a ON a.id = al.auction_id
      JOIN public.room_participants rp ON rp.room_id = a.room_id
      WHERE al.id = bot_lot_state.lot_id AND rp.user_id = auth.uid()
    )
  );
