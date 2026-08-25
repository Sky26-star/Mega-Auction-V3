// src/lib/v3-auction-types.ts
// Authoritative Data Contract for V3 Auction Engine

export type V3AuctionStatus = 'LOBBY' | 'READY' | 'STARTING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type V3LotStatus = 'PENDING' | 'GET_READY' | 'ACTIVE' | 'BIDDING' | 'SOLD' | 'UNSOLD' | 'SKIPPED';
export type V3PlayerRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
export type V3PlayerCategory = 'MARQUEE' | 'A' | 'B' | 'C' | 'D';

export interface V3Auction {
  id: string;
  room_id: string;
  status: V3AuctionStatus;
  current_lot_id: string | null;
  current_lot_index: number;
  paused_reason?: string | null;
}

export interface V3AuctionLot {
  id: string;
  auction_id: string;
  player_id: string;
  lot_index: number;
  status: V3LotStatus;
  base_price: number;
  current_bid: number;
  highest_bidder_team_id: string | null;
  winning_team_id: string | null;
  winning_bid: number | null;
  get_ready_expires_at: string | null;
  timer_expires_at: string | null;
}

export interface V3Player {
  id: string;
  name: string;
  role: V3PlayerRole;
  category: V3PlayerCategory;
  country: string;
  age: number | null;
  batting_hand: string | null;
  base_price: number;
  is_overseas: boolean;
  image_url: string | null;
}

export interface V3Team {
  id: string;
  name: string;
  short_name: string;
  purse: number;
  initial_purse: number;
  players_bought: number;
  overseas_count: number;
  is_bot: boolean;
}

export interface V3AuctionState {
  auction: V3Auction | null;
  currentLot: V3AuctionLot | null;
  currentPlayer: V3Player | null;
  teams: V3Team[];
}
