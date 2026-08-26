import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
  console.warn('Could not read .env.local', e);
}

const getEnv = (key: string): string => {
  if (process.env[key]) return process.env[key] as string;
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match && match[1] ? match[1].trim() : '';
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL') || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('REMOTE_SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export async function setupE2ETestRoom({ autoStartAuction = true, timer = 15, useBots = true } = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in env.');
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Create a test user
  const email = `test_host_${Date.now()}_${Math.random().toString(36).substring(7)}@megaauction.com`;
  const password = 'testpassword123';

  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userError) {
    throw new Error(`Failed to create test user: ${userError.message}`);
  }

  const userId = userData.user.id;

  // 2. Get a player set
  const { data: playerSets } = await adminClient.from('player_sets').select('*').eq('is_public', true).limit(1);
  if (!playerSets || playerSets.length === 0) {
    throw new Error('No public player sets found in database. Please seed the database with a public player set.');
  }
  const playerSetId = playerSets[0].id;

  // 3. Login as this user to get a session
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(`Failed to sign in: ${signInError.message}`);
  }

  // 4. Create Room via RPC
  // Get a valid public player set ID from players table so we guarantee it has lots
  const { data: fetchedSets } = await adminClient.from('players')
    .select('player_set_id, player_sets!inner(is_public)')
    .eq('player_sets.is_public', true)
    .limit(1);

  const PLAYER_SET_ID = fetchedSets && fetchedSets.length > 0 ? fetchedSets[0]?.player_set_id : playerSetId;

  // 4. Create the room and auction using the RPC
  const { data: roomData, error: roomError } = await userClient.rpc('create_room_with_team', {
    p_room_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    p_room_name: 'E2E Test Room',
    p_room_settings: { timer_duration_seconds: timer, get_ready_time: 3 },
    p_player_set_id: PLAYER_SET_ID,
    p_team_name: 'E2E Host Team',
    p_team_short_name: 'HOST',
    p_team_color: '#FF0000',
    p_default_purse: 100000000
  });

  if (roomError) {
    throw new Error(`Failed to create room: ${roomError.message}`);
  }

  const roomId = roomData.room_id;

  if (useBots) {
    // 5. Add a bot so there is someone else to bid against
    const { error: botError } = await userClient.rpc('provision_room_bots', {
      p_room_id: roomId,
      p_bots: [
        { name: 'Test Bot', short_name: 'BOT', color: '#0000FF' }
      ]
    });

    if (botError) {
      throw new Error(`Failed to provision bot: ${botError.message}`);
    }
  }

  if (autoStartAuction) {
    // 6. Start the auction
    const { data: startResult, error: startError } = await userClient.rpc('v3_start_auction', {
      p_room_id: roomId
    });

    if (startError) {
      throw new Error(`Failed to start auction: ${startError.message}`);
    }
    if (startResult && startResult.success === false) {
      throw new Error(`Failed to start auction (RPC): ${startResult.error}`);
    }
  }

  return {
    email,
    password,
    roomId,
    playerSetId,
  };
}

// Optional helper to start a local ticker loop for E2E tests
// Since we don't have a real cron job running in the E2E environment
export function startE2ETicker(baseUrl = 'http://127.0.0.1:3000') {
  console.log('[E2E TICKER] Starting background ticker');
  const interval = setInterval(async () => {
    try {
      await fetch(`${baseUrl}/api/auction/tick`, { method: 'POST' });
    } catch (e) {
      // Ignore fetch errors during teardown
    }
  }, 1000);

  return () => {
    console.log('[E2E TICKER] Stopping background ticker');
    clearInterval(interval);
  };
}
