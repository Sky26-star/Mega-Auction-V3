// src/lib/summary/loader.ts
// Authoritative Data Loader for Post-Auction Summary & Roster Analysis (/rooms/[id]/summary)

import { createClient } from '../supabase/client';
import { getCurrentProfile } from '../auth';

export interface SummaryPlayerItem {
  id: string;
  squadPlayerId?: string;
  name: string;
  role: string;
  category: string;
  country: string;
  isOverseas: boolean;
  basePriceCr: number;
  purchasePriceCr: number;
  boughtAt: string;
  isUnsoldRound: boolean;
  imageUrl?: string;
  teamId: string;
  teamName: string;
  teamColor: string;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  totalSpentCr: number;
  percentage: number;
}

export interface RoleBreakdown {
  role: string;
  count: number;
  totalSpentCr: number;
  percentage: number;
}

export interface DomesticVsOverseasBreakdown {
  domesticCount: number;
  domesticSpendCr: number;
  overseasCount: number;
  overseasSpendCr: number;
}

export interface SummaryTeamData {
  id: string;
  name: string;
  shortName: string;
  color: string;
  isBot: boolean;
  initialPurseCr: number;
  remainingPurseCr: number;
  totalSpentCr: number;
  playersBought: number;
  overseasCount: number;
  avgPurchasePriceCr: number;
  remainingSquadSlots: number;
  remainingOverseasSlots: number;
  maxSquadSize: number;
  maxOverseas: number;
  squad: SummaryPlayerItem[];
}

export interface SummaryOverview {
  roomCode: string;
  roomName: string;
  auctionId: string;
  status: string;
  totalLots: number;
  soldCount: number;
  unsoldCount: number;
  totalSpendCr: number;
  averagePurchasePriceCr: number;
  highestPurchaseCr: number;
  lowestPurchaseCr: number;
  round1SoldCount: number;
  round2SoldCount: number;
  durationMinutes: number;
  createdAt: string;
  completedAt: string | null;
}

export interface AuctionSummaryData {
  overview: SummaryOverview;
  teams: SummaryTeamData[];
  topBuys: SummaryPlayerItem[];
  unsoldLots: {
    id: string;
    lotIndex: number;
    playerName: string;
    role: string;
    category: string;
    country: string;
    isOverseas: boolean;
    basePriceCr: number;
    isUnsoldRound: boolean;
    imageUrl?: string;
  }[];
  categoryBreakdown: CategoryBreakdown[];
  roleBreakdown: RoleBreakdown[];
  domesticVsOverseas: DomesticVsOverseasBreakdown;
  isAuthorized: boolean;
  currentUserId?: string;
  hostId?: string;
}

export async function loadAuctionSummaryData(roomId: string): Promise<{ data: AuctionSummaryData | null; error: string | null }> {
  const supabase = createClient();
  const profile = await getCurrentProfile().catch(() => null);

  if (!profile) {
    return { data: null, error: 'AUTH_REQUIRED: You must be logged in to view auction summaries.' };
  }

  // 1. Fetch Room Data
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (roomError || !room) {
    return { data: null, error: 'ROOM_NOT_FOUND: Room does not exist or has been deleted.' };
  }

  // 2. Security Check: Participant Authorization
  const { data: participant } = await supabase
    .from('room_participants')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', profile.id)
    .maybeSingle();

  const isHost = room.host_id === profile.id;
  if (!participant && !isHost) {
    return { data: null, error: 'UNAUTHORIZED: You must be a room participant or host to view this auction summary.' };
  }

  // 3. Fetch Auction Record
  const { data: auction, error: aucError } = await supabase
    .from('auctions')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (aucError || !auction) {
    return { data: null, error: 'AUCTION_NOT_FOUND: Auction has not been initialized for this room.' };
  }

  // Parallel fetches for Teams, Squad Players, and Auction Lots
  const [teamsRes, squadRes, lotsRes] = await Promise.all([
    supabase.from('teams').select('*').eq('auction_id', auction.id).order('name', { ascending: true }),
    supabase.from('squad_players').select(`
      id,
      purchase_price,
      bought_at,
      team_id,
      lot_id,
      player:players (id, name, role, category, country, is_overseas, base_price, image_url),
      lot:auction_lots (id, is_unsold_round)
    `).eq('auction_id', auction.id).order('purchase_price', { ascending: false }),
    supabase.from('auction_lots').select(`
      id,
      lot_index,
      status,
      base_price,
      is_unsold_round,
      player:players (id, name, role, category, country, is_overseas, image_url)
    `).eq('auction_id', auction.id).order('lot_index', { ascending: true })
  ]);

  const rawTeams = teamsRes.data || [];
  const rawSquad = squadRes.data || [];
  const rawLots = lotsRes.data || [];

  const maxSquadSize = room.settings?.max_squad_size || 25;
  const maxOverseas = room.settings?.max_overseas || 8;

  // Process Squad Players
  const allSquadItems: SummaryPlayerItem[] = rawSquad.map((item: any) => {
    const player = item.player || {};
    const lot = item.lot || {};
    const team = rawTeams.find((t: any) => t.id === item.team_id) || {};
    return {
      id: player.id || item.id,
      squadPlayerId: item.id,
      name: player.name || 'Unknown Player',
      role: player.role || 'Batter',
      category: player.category || 'CAPPED',
      country: player.country || 'India',
      isOverseas: Boolean(player.is_overseas),
      basePriceCr: (player.base_price || 200) / 100,
      purchasePriceCr: (item.purchase_price || 0) / 100,
      boughtAt: item.bought_at || new Date().toISOString(),
      isUnsoldRound: Boolean(lot.is_unsold_round),
      imageUrl: player.image_url,
      teamId: item.team_id,
      teamName: team.name || 'Unknown Team',
      teamColor: team.color || '#6B7280',
    };
  });

  // Process Teams Data
  let totalSpendLakhs = 0;
  const processedTeams: SummaryTeamData[] = rawTeams.map((team: any) => {
    const teamSquad = allSquadItems.filter((s) => s.teamId === team.id);
    const totalSpentCr = teamSquad.reduce((sum, p) => sum + p.purchasePriceCr, 0);
    const initialPurseCr = (team.initial_purse || 12000) / 100;
    const remainingPurseCr = Math.max(0, initialPurseCr - totalSpentCr);
    const playersBought = teamSquad.length;
    const overseasCount = teamSquad.filter((p) => p.isOverseas).length;
    const avgPurchasePriceCr = playersBought > 0 ? totalSpentCr / playersBought : 0;
    totalSpendLakhs += Math.round(totalSpentCr * 100);

    return {
      id: team.id,
      name: team.name,
      shortName: team.short_name,
      color: team.color || '#6B7280',
      isBot: Boolean(team.is_bot),
      initialPurseCr,
      remainingPurseCr,
      totalSpentCr,
      playersBought,
      overseasCount,
      avgPurchasePriceCr,
      remainingSquadSlots: Math.max(0, maxSquadSize - playersBought),
      remainingOverseasSlots: Math.max(0, maxOverseas - overseasCount),
      maxSquadSize,
      maxOverseas,
      squad: teamSquad,
    };
  });

  // Process Auction Lots for Sold / Unsold counts
  const soldLots = rawLots.filter((l: any) => l.status === 'SOLD');
  const unsoldLotsRaw = rawLots.filter((l: any) => l.status === 'UNSOLD');

  const unsoldLots = unsoldLotsRaw.map((l: any) => {
    const player = l.player || {};
    return {
      id: l.id,
      lotIndex: l.lot_index,
      playerName: player.name || 'Passed Player',
      role: player.role || 'Batter',
      category: player.category || 'CAPPED',
      country: player.country || 'India',
      isOverseas: Boolean(player.is_overseas),
      basePriceCr: (l.base_price || 200) / 100,
      isUnsoldRound: Boolean(l.is_unsold_round),
      imageUrl: player.image_url,
    };
  });

  // Calculate Duration
  const createdMs = new Date(auction.created_at || Date.now()).getTime();
  const completedMs = auction.completed_at ? new Date(auction.completed_at).getTime() : Date.now();
  const durationMinutes = Math.max(1, Math.round((completedMs - createdMs) / (1000 * 60)));

  // Top Purchases & Purchase Metrics
  const topBuys = [...allSquadItems].sort((a, b) => b.purchasePriceCr - a.purchasePriceCr).slice(0, 5);
  const totalSpendCr = totalSpendLakhs / 100;
  const soldCount = soldLots.length;
  const averagePurchasePriceCr = soldCount > 0 ? totalSpendCr / soldCount : 0;
  const highestPurchaseCr = topBuys.length > 0 ? topBuys[0]?.purchasePriceCr || 0 : 0;
  const lowestPurchaseCr = allSquadItems.length > 0 ? Math.min(...allSquadItems.map((p) => p.purchasePriceCr)) : 0;
  const round1SoldCount = allSquadItems.filter((p) => !p.isUnsoldRound).length;
  const round2SoldCount = allSquadItems.filter((p) => p.isUnsoldRound).length;

  // Category Breakdown Calculation
  const categoryMap: Record<string, { count: number; spend: number }> = {};
  allSquadItems.forEach((p) => {
    const cat = p.category || 'UNCATEGORIZED';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, spend: 0 };
    categoryMap[cat].count += 1;
    categoryMap[cat].spend += p.purchasePriceCr;
  });
  const categoryBreakdown: CategoryBreakdown[] = Object.entries(categoryMap).map(([category, val]) => ({
    category,
    count: val.count,
    totalSpentCr: val.spend,
    percentage: totalSpendCr > 0 ? Math.round((val.spend / totalSpendCr) * 100) : 0,
  }));

  // Role Breakdown Calculation
  const roleMap: Record<string, { count: number; spend: number }> = {};
  allSquadItems.forEach((p) => {
    const role = p.role || 'ALL-ROUNDER';
    if (!roleMap[role]) roleMap[role] = { count: 0, spend: 0 };
    roleMap[role].count += 1;
    roleMap[role].spend += p.purchasePriceCr;
  });
  const roleBreakdown: RoleBreakdown[] = Object.entries(roleMap).map(([role, val]) => ({
    role,
    count: val.count,
    totalSpentCr: val.spend,
    percentage: totalSpendCr > 0 ? Math.round((val.spend / totalSpendCr) * 100) : 0,
  }));

  // Domestic vs Overseas Breakdown
  const domesticItems = allSquadItems.filter((p) => !p.isOverseas);
  const overseasItems = allSquadItems.filter((p) => p.isOverseas);
  const domesticVsOverseas: DomesticVsOverseasBreakdown = {
    domesticCount: domesticItems.length,
    domesticSpendCr: domesticItems.reduce((sum, p) => sum + p.purchasePriceCr, 0),
    overseasCount: overseasItems.length,
    overseasSpendCr: overseasItems.reduce((sum, p) => sum + p.purchasePriceCr, 0),
  };

  const overview: SummaryOverview = {
    roomCode: room.code,
    roomName: room.name,
    auctionId: auction.id,
    status: auction.status,
    totalLots: rawLots.length,
    soldCount,
    unsoldCount: unsoldLots.length,
    totalSpendCr,
    averagePurchasePriceCr,
    highestPurchaseCr,
    lowestPurchaseCr,
    round1SoldCount,
    round2SoldCount,
    durationMinutes,
    createdAt: auction.created_at,
    completedAt: auction.completed_at,
  };

  return {
    data: {
      overview,
      teams: processedTeams,
      topBuys,
      unsoldLots,
      categoryBreakdown,
      roleBreakdown,
      domesticVsOverseas,
      isAuthorized: true,
      currentUserId: profile.id,
      hostId: room.host_id,
    },
    error: null,
  };
}
