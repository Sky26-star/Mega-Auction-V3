// src/lib/rooms.ts
// Supabase Client Operations for Room & Team Management (Phase 5B — RPC & RLS Enforced)

import { createClient } from './supabase/client';
import { getCurrentProfile } from './auth';
import type {
  Room,
  RoomParticipant,
  Team,
  CreateRoomInput,
  JoinRoomInput,
  UpdateTeamInput,
} from './types/room';

export const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Helper to map RPC error messages to user-friendly text.
 */
export function formatRpcError(message: string): string {
  if (!message) return 'An unexpected error occurred.';
  if (message.includes('AUTH_REQUIRED')) return 'You must be logged in to perform this action.';
  if (message.includes('ROOM_NOT_FOUND')) return 'Room with this code was not found. Please check the code and try again.';
  if (message.includes('ROOM_NOT_OPEN')) return 'This room is no longer open for joining.';
  if (message.includes('NOT_IN_LOBBY')) return 'The auction session has already started or completed.';
  if (message.includes('INVALID_ROOM_NAME')) return 'Room name must be between 3 and 50 characters.';
  if (message.includes('INVALID_TEAM_NAME')) return 'Team name must be between 2 and 30 characters.';
  if (message.includes('INVALID_SHORT_NAME')) return 'Short name must be between 2 and 5 uppercase characters.';
  if (message.includes('INVALID_PURSE')) return 'Default purse must be at least 100 Lakhs/Cr.';
  if (message.includes('unique_auction_team_name')) return 'A team with this name already exists in this auction room. Please choose a different name.';
  if (message.includes('unique_auction_team_short_name')) return 'A team with this short code already exists in this auction room. Please choose a different code.';
  if (message.includes('PLAYER_SET_UNAUTHORIZED')) return 'You do not have permission to use the selected player set.';
  if (message.includes('PLAYER_SET_NOT_FOUND')) return 'Selected player set was not found.';
  if (message.includes('NOT_TEAM_OWNER')) return 'You do not own this team.';
  if (message.includes('AUCTION_NOT_LOBBY')) return 'Team identity cannot be changed after the auction starts.';
  if (message.includes('AUCTION_ACTIVE')) return 'Participant removal is only allowed while the auction is in LOBBY state.';
  if (message.includes('CANNOT_REMOVE_HOST')) return 'The host cannot be removed from the room.';
  if (message.includes('UNAUTHORIZED')) return 'You are not authorized to perform this action.';
  return message;
}

/**
 * Generates a random 6-character uppercase alphanumeric code.
 */
export function generateRandomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[idx];
  }
  return code;
}

/**
 * Generates a unique 6-character room code with bounded retry collisions.
 */
export async function generateUniqueRoomCode(maxAttempts = 5): Promise<string> {
  const supabase = createClient();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateCode = generateRandomCode();
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', candidateCode)
      .maybeSingle();

    if (!error && !data) {
      return candidateCode;
    }
  }

  throw new Error('Failed to generate a unique room code. Please try again.');
}

/**
 * Fetches all rooms accessible by the current authenticated user.
 */
export async function getRooms(): Promise<Room[]> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('User must be logged in');

  const supabase = createClient();

  const { data: participantData, error: partError } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', profile.id);

  if (partError) throw new Error(partError.message);

  const roomIds = (participantData || []).map((p: { room_id: string }) => p.room_id);

  let query = supabase.from('rooms').select(`
    *,
    host_profile:profiles!rooms_host_id_fkey(id, username, display_name, avatar_url),
    auctions(id, player_set_id, player_sets(name))
  `).order('created_at', { ascending: false });

  if (roomIds.length > 0) {
    query = query.or(`host_id.eq.${profile.id},id.in.(${roomIds.join(',')})`);
  } else {
    query = query.eq('host_id', profile.id);
  }

  const { data: roomRows, error } = await query;
  if (error) throw new Error(error.message);

  return (roomRows || []).map((r: any) => {
    const auction = Array.isArray(r.auctions) ? r.auctions[0] : (r.auctions || null);
    const playerSet = auction?.player_sets ? (Array.isArray(auction.player_sets) ? auction.player_sets[0] : auction.player_sets) : null;
    return {
      ...r,
      player_set_name: playerSet?.name ?? 'Default Pool',
      auction_id: auction?.id,
    };
  });
}

/**
 * Fetches single Room by ID along with host info and auction ID.
 */
export async function getRoomById(roomId: string): Promise<Room | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rooms')
    .select(`
      *,
      host_profile:profiles!rooms_host_id_fkey(id, username, display_name, avatar_url),
      auctions(id, player_set_id, player_sets(name))
    `)
    .eq('id', roomId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  const auction = Array.isArray(data.auctions) ? data.auctions[0] : (data.auctions || null);
  const playerSet = auction?.player_sets ? (Array.isArray(auction.player_sets) ? auction.player_sets[0] : auction.player_sets) : null;

  return {
    ...data,
    player_set_name: playerSet?.name ?? 'Default Pool',
    auction_id: auction?.id,
  };
}

/**
 * Looks up room details by 6-character code for Room Preview step (read-only).
 */
export async function lookupRoomByCode(code: string): Promise<Room> {
  const supabase = createClient();
  const cleanCode = code.trim().toUpperCase();

  const { data, error } = await supabase
    .from('rooms')
    .select(`
      *,
      host_profile:profiles!rooms_host_id_fkey(id, username, display_name, avatar_url),
      auctions(id, player_set_id, player_sets(name))
    `)
    .eq('code', cleanCode)
    .single();

  if (error || !data) {
    throw new Error(`Room with code "${cleanCode}" was not found.`);
  }

  const auction = Array.isArray(data.auctions) ? data.auctions[0] : (data.auctions || null);
  const playerSet = auction?.player_sets ? (Array.isArray(auction.player_sets) ? auction.player_sets[0] : auction.player_sets) : null;

  return {
    ...data,
    player_set_name: playerSet?.name ?? 'Default Pool',
    auction_id: auction?.id,
  };
}

/**
 * Creates a new Room + Host Participant + Auction + Host Team in a single atomic transaction.
 * Calls RPC create_room_with_team().
 */
export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('User must be logged in to create a room');

  const supabase = createClient();

  const roomSettings = {
    timer_duration_seconds: input.timer_duration_seconds,
    min_bid_increment: input.min_bid_increment,
    default_purse: input.default_purse,
    max_squad_size: input.max_squad_size,
    max_overseas: input.max_overseas,
    player_set_id: input.player_set_id,
    player_order: 'CATEGORY',
  };

  const { data, error } = await supabase.rpc('create_room_with_team', {
    p_room_name: input.name,
    p_room_settings: roomSettings,
    p_player_set_id: input.player_set_id,
    p_team_name: input.team_name,
    p_team_short_name: input.team_short_name.toUpperCase(),
    p_team_color: input.team_color,
    p_default_purse: input.default_purse,
  });

  if (error) {
    throw new Error(formatRpcError(error.message));
  }

  const createdRoom = await getRoomById(data.room_id);
  if (!createdRoom) {
    throw new Error('Room created successfully, but failed to fetch room details.');
  }

  return createdRoom;
}

/**
 * Joins an existing room and creates participant's team in a single atomic transaction.
 * Calls RPC join_room_with_team().
 */
export async function joinRoomWithTeam(
  roomCode: string,
  teamInput: JoinRoomInput
): Promise<{ room_id: string; already_joined: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('User must be logged in to join a room');

  const supabase = createClient();

  const { data, error } = await supabase.rpc('join_room_with_team', {
    p_room_code: roomCode.trim().toUpperCase(),
    p_team_name: teamInput.team_name,
    p_team_short_name: teamInput.team_short_name.toUpperCase(),
    p_team_color: teamInput.team_color,
  });

  if (error) {
    throw new Error(formatRpcError(error.message));
  }

  return {
    room_id: data.room_id,
    already_joined: data.already_joined ?? false,
  };
}

/**
 * Legacy wrapper for joinRoomByCode — maps to lookupRoomByCode for backward compatibility.
 */
export async function joinRoomByCode(code: string): Promise<Room> {
  return lookupRoomByCode(code);
}

/**
 * Updates a participant's own team identity (Name, Short Code, Color) via RPC update_my_team().
 */
export async function updateMyTeam(teamId: string, input: UpdateTeamInput): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc('update_my_team', {
    p_team_id: teamId,
    p_team_name: input.team_name,
    p_team_short_name: input.team_short_name.toUpperCase(),
    p_team_color: input.team_color,
  });

  if (error) {
    throw new Error(formatRpcError(error.message));
  }
}

/**
 * Removes a participant and their team from a room via RPC remove_room_participant().
 * Callable by self (leave room) or room host (moderation).
 */
export async function removeRoomParticipant(participantId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc('remove_room_participant', {
    p_participant_id: participantId,
  });

  if (error) {
    throw new Error(formatRpcError(error.message));
  }
}

/**
 * Fetches all participants for a room with profiles and assigned team info.
 */
export async function getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('room_participants')
    .select(`
      *,
      profile:profiles(id, username, display_name, avatar_url),
      team:teams(id, name, short_name, color)
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as RoomParticipant[];
}

/**
 * Fetches all teams for an auction.
 */
export async function getAuctionTeams(auctionId: string): Promise<Team[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as Team[];
}

