// src/lib/csv-parser.ts
// Zero-Dependency Native CSV Parser & Validator for Mega Auction V1

import { PLAYER_ROLES, PLAYER_CATEGORIES } from './validations/player-set';
import type { PlayerFormInput, CSVRowValidationError, CSVImportResult, PlayerRole, PlayerCategory } from './types/player-set';

const MAX_CSV_ROWS = 2000;

/**
 * Splits a single CSV line into fields, handling quotes and escaped quotes.
 * Supports values like: "Kohli, Virat",BATSMAN,"MARQUEE",200,false,"http://url.com"
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses and validates an entire CSV text string.
 */
export function parsePlayerCSV(csvText: string): CSVImportResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, field: 'file', message: 'CSV file is empty', rawValue: '' }],
      totalRowsProcessed: 0,
    };
  }

  // Parse header
  const headerLine = lines[0] ?? '';
  const rawHeaders = parseCSVLine(headerLine);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[\s_]+/g, ''));

  const requiredHeaders = ['name', 'role'];
  const missingHeaders = requiredHeaders.filter((req) => !headers.includes(req));

  if (missingHeaders.length > 0) {
    return {
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          field: 'header',
          message: `Missing required CSV header columns: ${missingHeaders.join(', ')}. Expected headers: name,role,category,base_price,is_overseas,image_url`,
          rawValue: headerLine,
        },
      ],
      totalRowsProcessed: 0,
    };
  }

  const nameIndex = headers.indexOf('name');
  const roleIndex = headers.indexOf('role');
  const categoryIndex = headers.indexOf('category');
  const basePriceIndex = headers.indexOf('baseprice');
  const isOverseasIndex = headers.indexOf('isoverseas');
  const imageUrlIndex = headers.indexOf('imageurl');

  const dataLines = lines.slice(1);
  if (dataLines.length > MAX_CSV_ROWS) {
    return {
      validRows: [],
      errors: [
        {
          rowNumber: 0,
          field: 'file',
          message: `CSV contains ${dataLines.length} rows, exceeding maximum limit of ${MAX_CSV_ROWS} rows per upload`,
          rawValue: '',
        },
      ],
      totalRowsProcessed: dataLines.length,
    };
  }

  const validRows: PlayerFormInput[] = [];
  const errors: CSVRowValidationError[] = [];

  dataLines.forEach((line, idx) => {
    const rowNumber = idx + 2; // 1-based index (Header is row 1)
    const fields = parseCSVLine(line);

    const rawName = fields[nameIndex] ?? '';
    const rawRole = (fields[roleIndex] ?? '').toUpperCase();
    const rawCategory = categoryIndex !== -1 && fields[categoryIndex] ? fields[categoryIndex]!.toUpperCase() : 'C';
    const rawBasePrice = basePriceIndex !== -1 ? fields[basePriceIndex] ?? '1' : '1';
    const rawIsOverseas = isOverseasIndex !== -1 ? fields[isOverseasIndex] ?? 'false' : 'false';
    const rawImageUrl = imageUrlIndex !== -1 ? fields[imageUrlIndex] ?? '' : '';

    let rowHasError = false;

    // Validate Name
    if (!rawName) {
      errors.push({ rowNumber, field: 'name', message: 'Player name is required', rawValue: line });
      rowHasError = true;
    }

    // Validate Role
    if (!PLAYER_ROLES.includes(rawRole as PlayerRole)) {
      errors.push({
        rowNumber,
        field: 'role',
        message: `Invalid role "${rawRole}". Must be one of: ${PLAYER_ROLES.join(', ')}`,
        rawValue: rawRole,
      });
      rowHasError = true;
    }

    // Validate Category
    let category: PlayerCategory = 'C';
    if (rawCategory) {
      if (!PLAYER_CATEGORIES.includes(rawCategory as PlayerCategory)) {
        errors.push({
          rowNumber,
          field: 'category',
          message: `Invalid category "${rawCategory}". Must be one of: ${PLAYER_CATEGORIES.join(', ')}`,
          rawValue: rawCategory,
        });
        rowHasError = true;
      } else {
        category = rawCategory as PlayerCategory;
      }
    }

    // Validate Base Price
    const basePrice = parseInt(rawBasePrice, 10);
    if (isNaN(basePrice) || basePrice < 1) {
      errors.push({
        rowNumber,
        field: 'base_price',
        message: `Invalid base price "${rawBasePrice}". Must be a positive integer >= 1`,
        rawValue: rawBasePrice,
      });
      rowHasError = true;
    }

    // Validate Is Overseas
    const lowerOverseas = rawIsOverseas.toLowerCase();
    const isOverseas = ['true', '1', 'yes', 'y'].includes(lowerOverseas);

    // Validate Image URL (optional)
    let imageUrl: string | null = null;
    if (rawImageUrl) {
      try {
        new URL(rawImageUrl);
        imageUrl = rawImageUrl;
      } catch {
        errors.push({
          rowNumber,
          field: 'image_url',
          message: `Invalid image URL "${rawImageUrl}"`,
          rawValue: rawImageUrl,
        });
        rowHasError = true;
      }
    }

    if (!rowHasError) {
      validRows.push({
        name: rawName,
        role: rawRole as PlayerRole,
        category,
        base_price: basePrice,
        is_overseas: isOverseas,
        image_url: imageUrl,
      });
    }
  });

  return {
    validRows,
    errors,
    totalRowsProcessed: dataLines.length,
  };
}
