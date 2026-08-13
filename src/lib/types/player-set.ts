// src/lib/types/player-set.ts
// Player & Player Set TypeScript Interfaces for Mega Auction V1

export type PlayerRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
export type PlayerCategory = 'MARQUEE' | 'A' | 'B' | 'C' | 'D';

export interface PlayerSet {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  player_count?: number;
}

export interface Player {
  id: string;
  player_set_id: string;
  name: string;
  role: PlayerRole;
  category: PlayerCategory;
  base_price: number;
  is_overseas: boolean;
  image_url: string | null;
  created_at: string;
}

export interface PlayerSetFormInput {
  name: string;
  description?: string | null;
  is_public: boolean;
}

export interface PlayerFormInput {
  name: string;
  role: PlayerRole;
  category: PlayerCategory;
  base_price: number;
  is_overseas: boolean;
  image_url?: string | null;
}

export interface CSVPlayerRow {
  name: string;
  role: string;
  category: string;
  base_price: string | number;
  is_overseas: string | boolean;
  image_url?: string;
}

export interface CSVRowValidationError {
  rowNumber: number;
  field: string;
  message: string;
  rawValue: string;
}

export interface CSVImportResult {
  validRows: PlayerFormInput[];
  errors: CSVRowValidationError[];
  totalRowsProcessed: number;
}
