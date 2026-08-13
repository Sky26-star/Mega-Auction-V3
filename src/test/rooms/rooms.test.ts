// src/test/rooms/rooms.test.ts
// Phase 5B Room & Team Ownership Unit Test Suite

import { describe, it, expect } from 'vitest';
import { generateRandomCode } from '@/lib/rooms';
import {
  createRoomSchema,
  joinRoomSchema,
  joinRoomWithTeamSchema,
  updateMyTeamSchema,
  teamSchema,
  ROOM_CODE_REGEX,
  HEX_COLOR_REGEX,
} from '@/lib/validations/room';

describe('Phase 5 — Room & Team Unit Test Suite', () => {
  describe('Room Code Generation & Regex', () => {
    it('generates a 6-character uppercase alphanumeric code', () => {
      const code = generateRandomCode();
      expect(code).toHaveLength(6);
      expect(ROOM_CODE_REGEX.test(code)).toBe(true);
    });

    it('validates joinRoomSchema with valid 6-character codes', () => {
      const result = joinRoomSchema.safeParse({ code: 'KX9P2B' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('KX9P2B');
      }
    });

    it('rejects invalid room codes (wrong length or special characters)', () => {
      expect(joinRoomSchema.safeParse({ code: 'KX9P2' }).success).toBe(false); // 5 chars
      expect(joinRoomSchema.safeParse({ code: 'KX9P2B7' }).success).toBe(false); // 7 chars
      expect(joinRoomSchema.safeParse({ code: 'KX9P-B' }).success).toBe(false); // dash
    });
  });

  describe('createRoomSchema (Phase 5B)', () => {
    it('validates a valid room & host franchise creation payload', () => {
      const payload = {
        name: 'IPL 2026 Grand Auction',
        player_set_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        default_purse: 1000,
        timer_duration_seconds: 15,
        min_bid_increment: 5,
        max_squad_size: 25,
        max_overseas: 8,
        team_name: 'Royal Challengers',
        team_short_name: 'RCB',
        team_color: '#EF4444',
      };
      const result = createRoomSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects room name shorter than 3 characters', () => {
      const result = createRoomSchema.safeParse({
        name: 'AB',
        player_set_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        default_purse: 1000,
        timer_duration_seconds: 15,
        min_bid_increment: 5,
        max_squad_size: 25,
        max_overseas: 8,
        team_name: 'Royal Challengers',
        team_short_name: 'RCB',
        team_color: '#EF4444',
      });
      expect(result.success).toBe(false);
    });

    it('rejects timer duration out of range (5s to 60s)', () => {
      const resultTooLow = createRoomSchema.safeParse({
        name: 'Valid Room Name',
        player_set_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        default_purse: 1000,
        timer_duration_seconds: 3, // too low
        min_bid_increment: 5,
        max_squad_size: 25,
        max_overseas: 8,
        team_name: 'Royal Challengers',
        team_short_name: 'RCB',
        team_color: '#EF4444',
      });
      expect(resultTooLow.success).toBe(false);

      const resultTooHigh = createRoomSchema.safeParse({
        name: 'Valid Room Name',
        player_set_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        default_purse: 1000,
        timer_duration_seconds: 120, // too high
        min_bid_increment: 5,
        max_squad_size: 25,
        max_overseas: 8,
        team_name: 'Royal Challengers',
        team_short_name: 'RCB',
        team_color: '#EF4444',
      });
      expect(resultTooHigh.success).toBe(false);
    });

    it('rejects default purse less than 100', () => {
      const result = createRoomSchema.safeParse({
        name: 'Valid Room Name',
        player_set_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        default_purse: 50, // invalid
        timer_duration_seconds: 15,
        min_bid_increment: 5,
        max_squad_size: 25,
        max_overseas: 8,
        team_name: 'Royal Challengers',
        team_short_name: 'RCB',
        team_color: '#EF4444',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Phase 5B Join and Edit Schemas', () => {
    it('validates joinRoomWithTeamSchema', () => {
      const result = joinRoomWithTeamSchema.safeParse({
        team_name: 'Chennai Super Kings',
        team_short_name: 'CSK',
        team_color: '#F59E0B',
      });
      expect(result.success).toBe(true);
    });

    it('validates updateMyTeamSchema', () => {
      const result = updateMyTeamSchema.safeParse({
        team_name: 'Mumbai Indians',
        team_short_name: 'MI',
        team_color: '#3B82F6',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid team color format in updateMyTeamSchema', () => {
      const result = updateMyTeamSchema.safeParse({
        team_name: 'Mumbai Indians',
        team_short_name: 'MI',
        team_color: 'blue',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('teamSchema', () => {
    it('validates a valid team payload', () => {
      const payload = {
        name: 'Mumbai Indians',
        short_name: 'MI',
        color: '#004BA0',
        initial_purse: 1000,
        is_bot: false,
      };
      const result = teamSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects short_name outside 2-5 character limit', () => {
      const resultOneChar = teamSchema.safeParse({
        name: 'Mumbai Indians',
        short_name: 'M',
        color: '#004BA0',
        initial_purse: 1000,
        is_bot: false,
      });
      expect(resultOneChar.success).toBe(false);

      const resultSixChars = teamSchema.safeParse({
        name: 'Mumbai Indians',
        short_name: 'MUMBAI',
        color: '#004BA0',
        initial_purse: 1000,
        is_bot: false,
      });
      expect(resultSixChars.success).toBe(false);
    });

    it('rejects invalid hex color format', () => {
      const result = teamSchema.safeParse({
        name: 'Chennai Super Kings',
        short_name: 'CSK',
        color: 'yellow', // invalid hex
        initial_purse: 1000,
        is_bot: false,
      });
      expect(result.success).toBe(false);
    });

    it('validates HEX_COLOR_REGEX', () => {
      expect(HEX_COLOR_REGEX.test('#FF5733')).toBe(true);
      expect(HEX_COLOR_REGEX.test('#000000')).toBe(true);
      expect(HEX_COLOR_REGEX.test('#FFFFFF')).toBe(true);
      expect(HEX_COLOR_REGEX.test('#FFF')).toBe(false); // 3-digit hex invalid
      expect(HEX_COLOR_REGEX.test('123456')).toBe(false); // missing hash
    });
  });
});

