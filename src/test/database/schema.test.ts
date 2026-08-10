import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 2A Static SQL Migration & Schema Specification Verification', () => {
  const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations');
  
  const migrationFiles = [
    '00001_core_tables.sql',
    '00002_auction_tables.sql',
    '00003_indexes.sql',
    '00004_triggers.sql',
    '00005_rls_policies.sql',
  ];

  let combinedSql = '';
  let indexSql = '';

  beforeAll(() => {
    migrationFiles.forEach((file) => {
      const filePath = path.join(migrationsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      combinedSql += content + '\n';
      if (file === '00003_indexes.sql') {
        indexSql = content;
      }
    });
  });

  it('1. Contains all 12 V1 core and auction tables', () => {
    const requiredTables = [
      'public.profiles',
      'public.rooms',
      'public.player_sets',
      'public.players',
      'public.room_participants',
      'public.auctions',
      'public.teams',
      'public.auction_lots',
      'public.squad_players',
      'public.bids',
      'public.auction_events',
      'public.bot_lot_state',
    ];

    requiredTables.forEach((table) => {
      expect(combinedSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    });
  });

  it('2. Enforces Bid Idempotency via request_id UNIQUE constraint', () => {
    expect(combinedSql).toContain('request_id UUID NOT NULL UNIQUE');
  });

  it('3. Enforces Realtime Event Sequence authority and UNIQUE(auction_id, sequence)', () => {
    expect(combinedSql).toContain('current_sequence INT NOT NULL DEFAULT 0');
    expect(combinedSql).toContain('CONSTRAINT unique_auction_sequence UNIQUE(auction_id, sequence)');
  });

  it('4. Includes Room Participant heartbeat field last_seen_at', () => {
    expect(combinedSql).toContain('last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  });

  it('5. Defines exactly 22 custom performance indexes in 00003_indexes.sql', () => {
    const createIndexMatches = indexSql.match(/CREATE INDEX IF NOT EXISTS/g);
    expect(createIndexMatches).not.toBeNull();
    expect(createIndexMatches?.length).toBe(22);
  });

  it('6. Enables Row Level Security (RLS) on all 12 tables', () => {
    const rlsTables = [
      'public.profiles',
      'public.rooms',
      'public.room_participants',
      'public.player_sets',
      'public.players',
      'public.auctions',
      'public.teams',
      'public.auction_lots',
      'public.squad_players',
      'public.bids',
      'public.auction_events',
      'public.bot_lot_state',
    ];

    rlsTables.forEach((table) => {
      expect(combinedSql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    });
  });

  it('7. Strictly excludes Phase 2B RPC functions and business logic', () => {
    const prohibitedRpcs = [
      'process_bid',
      'process_lot_expiry',
      'start_auction',
      'pause_auction',
      'resume_auction',
      'evaluate_bot_interests',
      'check_and_execute_bot_bids',
      'purchase_player',
    ];

    prohibitedRpcs.forEach((rpc) => {
      expect(combinedSql).not.toContain(`FUNCTION public.${rpc}`);
    });
  });
});
