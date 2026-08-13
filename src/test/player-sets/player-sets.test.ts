// src/test/player-sets/player-sets.test.ts
// Phase 4 Player & Player Set Unit Test Suite

import { describe, it, expect } from 'vitest';
import { parseCSVLine, parsePlayerCSV } from '@/lib/csv-parser';
import { playerSetSchema, playerSchema } from '@/lib/validations/player-set';

describe('Phase 4 — Player & Player Set Validation Schemas', () => {
  describe('playerSetSchema', () => {
    it('validates a valid player set', () => {
      const result = playerSetSchema.safeParse({
        name: 'IPL 2026 Mega Auction Pool',
        description: 'Top international & domestic stars',
        is_public: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty player set name', () => {
      const result = playerSetSchema.safeParse({
        name: '',
        description: 'Some desc',
        is_public: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('playerSchema', () => {
    it('validates a valid player input', () => {
      const result = playerSchema.safeParse({
        name: 'Virat Kohli',
        role: 'BATSMAN',
        category: 'MARQUEE',
 base_price: 200,
        is_overseas: false,
        image_url: 'https://example.com/kohli.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid role', () => {
      const result = playerSchema.safeParse({
        name: 'Player One',
        role: 'CAPTAIN', // invalid
        category: 'A',
        base_price: 10,
        is_overseas: false,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid category', () => {
      const result = playerSchema.safeParse({
        name: 'Player Two',
        role: 'BOWLER',
        category: 'GOLD', // invalid
        base_price: 10,
        is_overseas: false,
      });
      expect(result.success).toBe(false);
    });

    it('rejects base_price less than 1', () => {
      const result = playerSchema.safeParse({
        name: 'Player Three',
        role: 'BATSMAN',
        category: 'C',
        base_price: 0,
        is_overseas: false,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Phase 4 — Native CSV Parser', () => {
  describe('parseCSVLine', () => {
    it('splits simple comma separated fields', () => {
      const fields = parseCSVLine('Virat Kohli,BATSMAN,MARQUEE,200,false');
      expect(fields).toEqual(['Virat Kohli', 'BATSMAN', 'MARQUEE', '200', 'false']);
    });

    it('correctly handles quoted fields containing commas', () => {
      const fields = parseCSVLine('"Kohli, Virat",BATSMAN,"MARQUEE, STAR",200,false');
      expect(fields).toEqual(['Kohli, Virat', 'BATSMAN', 'MARQUEE, STAR', '200', 'false']);
    });

    it('handles escaped quotes inside quoted fields', () => {
      const fields = parseCSVLine('"Player ""The Boss"" One",BOWLER,A,50,true');
      expect(fields).toEqual(['Player "The Boss" One', 'BOWLER', 'A', '50', 'true']);
    });
  });

  describe('parsePlayerCSV', () => {
    it('parses valid CSV text cleanly', () => {
      const csvData = `name,role,category,base_price,is_overseas,image_url
Virat Kohli,BATSMAN,MARQUEE,200,false,https://example.com/kohli.jpg
Jasprit Bumrah,BOWLER,MARQUEE,200,false,
Rashid Khan,BOWLER,A,150,true,`;

      const result = parsePlayerCSV(csvData);
      expect(result.errors.length).toBe(0);
      expect(result.validRows.length).toBe(3);
      expect(result.validRows[0]).toEqual({
        name: 'Virat Kohli',
        role: 'BATSMAN',
        category: 'MARQUEE',
        base_price: 200,
        is_overseas: false,
        image_url: 'https://example.com/kohli.jpg',
      });
      expect(result.validRows[2]?.is_overseas).toBe(true);
    });

    it('correctly converts boolean variations for is_overseas (true/false/1/0/yes/no)', () => {
      const csvData = `name,role,category,base_price,is_overseas
Player 1,BATSMAN,A,10,1
Player 2,BOWLER,B,10,yes
Player 3,ALL_ROUNDER,C,10,0
Player 4,WICKET_KEEPER,D,10,no`;

      const result = parsePlayerCSV(csvData);
      expect(result.validRows.length).toBe(4);
      expect(result.validRows[0]?.is_overseas).toBe(true);
      expect(result.validRows[1]?.is_overseas).toBe(true);
      expect(result.validRows[2]?.is_overseas).toBe(false);
      expect(result.validRows[3]?.is_overseas).toBe(false);
    });

    it('defaults category to C when category column is omitted or empty', () => {
      const csvData = `name,role,base_price,is_overseas
Default Player,BATSMAN,25,false`;

      const result = parsePlayerCSV(csvData);
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0]?.category).toBe('C');
    });

    it('fails gracefully and reports missing required headers', () => {
      const csvData = `invalid_header_1,invalid_header_2
Data 1,Data 2`;

      const result = parsePlayerCSV(csvData);
      expect(result.validRows.length).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.field).toBe('header');
    });

    it('separates valid rows and records row-level errors for invalid rows', () => {
      const csvData = `name,role,category,base_price,is_overseas
Valid Player 1,BATSMAN,MARQUEE,100,false
Invalid Role Player,STRIKER,A,50,false
Invalid Price Player,BOWLER,B,-10,true
Valid Player 2,WICKET_KEEPER,C,20,true`;

      const result = parsePlayerCSV(csvData);
      expect(result.validRows.length).toBe(2);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]?.rowNumber).toBe(3); // Line 3
      expect(result.errors[0]?.field).toBe('role');
      expect(result.errors[1]?.rowNumber).toBe(4); // Line 4
      expect(result.errors[1]?.field).toBe('base_price');
    });
  });
});
