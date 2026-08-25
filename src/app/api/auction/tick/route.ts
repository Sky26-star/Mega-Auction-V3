import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateBotsForLot, AuctionContext } from '@/lib/auction/server-bot-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    // 1. Find active or paused auctions
    const { data: activeAuctions, error: auctionsError } = await supabase
      .from('auctions')
      .select('id, room_id, status, current_lot_id, paused_reason')
      .in('status', ['IN_PROGRESS', 'PAUSED']);

    if (auctionsError) throw auctionsError;
    if (!activeAuctions || activeAuctions.length === 0) {
      return NextResponse.json({ success: true, actions: [], message: 'No active or paused auctions' });
    }

    const actionsTaken: any[] = [];

    // 2. Process each active auction
    for (const auction of activeAuctions) {
      if (auction.status === 'PAUSED') {
        if (auction.paused_reason) {
          try {
            const parsed = JSON.parse(auction.paused_reason);
            if (parsed.resume_expires_at && Date.now() >= parsed.resume_expires_at) {
              const { error: resumeError } = await supabase.rpc('resume_auction', { p_auction_id: auction.id });
              if (resumeError) {
                console.error(`[TICKER] Failed to resume auction ${auction.id}:`, resumeError);
              } else {
                console.log(`[TICKER] Resumed auction ${auction.id} after countdown`);
                actionsTaken.push({ auction: auction.id, action: 'RESUME_AUCTION' });
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        continue; // Skip further lot processing for paused auctions
      }

      if (!auction.current_lot_id) continue;

      // Read current lot authoritative state
      const { data: lot, error: lotError } = await supabase
        .from('auction_lots')
        .select(`
          id, lot_index, status, current_bid, base_price, highest_bidder_team_id,
          timer_expires_at, get_ready_expires_at, player_id,
          players (id, name, category, role, country, is_overseas, base_price)
        `)
        .eq('id', auction.current_lot_id)
        .single();

      if (lotError || !lot) continue;

      const now = Date.now();
      const getReadyExpiresAt = lot.get_ready_expires_at ? new Date(lot.get_ready_expires_at).getTime() : 0;
      const timerExpiresAt = lot.timer_expires_at ? new Date(lot.timer_expires_at).getTime() : 0;

      // Check transitions
      if (lot.status === 'GET_READY' && getReadyExpiresAt && now >= getReadyExpiresAt) {
        // Transition to BIDDING
        const { data, error } = await supabase.rpc('v3_start_bidding', {
          p_auction_id: auction.id,
          p_lot_id: lot.id,
          p_force: true
        });

        if (data && data.success === false) {
           console.log(`\nAUCTION_TICK\nauction=${auction.id}\nlot=${lot.id}\nphase=GET_READY\naction=START_BIDDING\nresult=SKIPPED\nreason=${data.error}`);
           actionsTaken.push({ auction: auction.id, lot: lot.id, action: 'START_BIDDING_REJECTED', error: data.error });
           continue;
        }

        console.log(`\nAUCTION_TICK\nauction=${auction.id}\nlot=${lot.id}\nphase=GET_READY\naction=START_BIDDING\nresult=APPLIED`);
        actionsTaken.push({ auction: auction.id, lot: lot.id, action: 'START_BIDDING', error: error?.message });
        continue; // Processed this lot for this tick
      }

      if (lot.status === 'BIDDING' && timerExpiresAt && now >= timerExpiresAt) {
        // Transition to SOLD/UNSOLD and advance
        const { data, error } = await supabase.rpc('v3_finalize_and_advance_lot', {
          p_auction_id: auction.id,
          p_lot_id: lot.id,
          p_force: true
        });

        if (data && data.success === false) {
           console.log(`\nAUCTION_TICK\nauction=${auction.id}\nlot=${lot.id}\nphase=BIDDING\naction=FINALIZE\nresult=SKIPPED\nreason=${data.error}`);
           actionsTaken.push({ auction: auction.id, lot: lot.id, action: 'FINALIZE_LOT_REJECTED', error: data.error });
           continue;
        }

        console.log(`\nAUCTION_TICK\nauction=${auction.id}\nlot=${lot.id}\nphase=BIDDING\naction=FINALIZE\nresult=APPLIED`);
        actionsTaken.push({ auction: auction.id, lot: lot.id, action: 'FINALIZE_LOT', error: error?.message });
        continue; // Processed this lot for this tick
      }

      if (lot.status === 'BIDDING' && timerExpiresAt && now < timerExpiresAt) {
        // Bot evaluation time
        // Need Room Settings, Bot Teams, All Teams, and future lots for context
        const [{ data: room }, { data: allTeamsData }, { data: allLots }] = await Promise.all([
          supabase.from('rooms').select('settings').eq('id', auction.room_id).single(),
          supabase.from('teams').select('*').eq('auction_id', auction.id),
          supabase.from('auction_lots').select('status, base_price, winning_team_id, winning_bid, players(role, category, base_price, is_overseas)').eq('auction_id', auction.id)
        ]);

        if (!room || !allTeamsData || !allLots) continue;

        const allTeamsRaw = allTeamsData as any[];

        // Build context first to count rosters
        const settings = (room.settings || {}) as any;
        const rosters: Record<string, any[]> = {};
        const purchasePrices: Record<string, number[]> = {};
        const futurePlayers: any[] = [];

        for (const l of allLots) {
          const p = l.players as any;
          const tid = l.winning_team_id as string;
          if (l.status === 'SOLD' && tid && p) {
            if (!rosters[tid]) rosters[tid] = [];
            rosters[tid].push(p);
            if (!purchasePrices[tid]) purchasePrices[tid] = [];
            purchasePrices[tid].push(l.winning_bid || l.base_price);
          }
          if (l.status === 'PENDING' && p) {
            futurePlayers.push({
              role: p.role || 'BATSMAN',
              category: p.category || 'D',
              base_price: p.base_price || l.base_price,
              is_overseas: p.is_overseas || false
            });
          }
        }

        const futureByRole: Record<string, number> = {};
        for (const fp of futurePlayers) {
          futureByRole[fp.role] = (futureByRole[fp.role] || 0) + 1;
        }
        const bps = futurePlayers.map(fp => fp.base_price);

        const ctx: AuctionContext = {
          maxSquadSize: settings.max_squad_size || 25,
          maxOverseas: settings.max_overseas || 8,
          totalLots: allLots.length,
          futurePlayers,
          futureByRole,
          futureOverseasCount: futurePlayers.filter(fp => fp.is_overseas).length,
          futureAvgBasePrice: bps.length > 0 ? bps.reduce((s, v) => s + v, 0) / bps.length : 50,
          futureMinBasePrice: bps.length > 0 ? Math.min(...bps) : 20,
          teamPurchasePrices: purchasePrices,
        };

        const allTeams = allTeamsRaw.map(t => ({
          id: t.id,
          name: t.name,
          short_name: t.short_name,
          purse: t.purse,
          initial_purse: t.initial_purse || 10000,
          players_bought: rosters[t.id]?.length || 0,
          overseas_count: rosters[t.id]?.filter(p => p.is_overseas).length || 0,
          is_bot: !!t.is_bot
        }));

        const botTeams = allTeams.filter(t => t.is_bot);
        if (botTeams.length === 0) continue;

        const player = lot.players as any;
        const validBids = evaluateBotsForLot(
          botTeams,
          player,
          lot.current_bid,
          lot.base_price,
          lot.highest_bidder_team_id,
          settings.bot_difficulty || 'Normal',
          allTeams,
          rosters,
          ctx,
          lot.timer_expires_at
        );

        console.log(`[BOT EVAL] Lot: ${lot.id}, Bots: ${botTeams.length}, ValidBids: ${validBids.length}`);

        // Execute valid bids
        for (const bid of validBids) {
          // Check if timer still allows
          const timerDurationMs = (settings.timer_duration_seconds || 15) * 1000;
          const timeSinceStart = timerExpiresAt ? timerDurationMs - (timerExpiresAt - Date.now()) : 0;
          if (timeSinceStart < bid.delayMs) continue;

          // Place the bid via RPC
          const requestId = crypto.randomUUID();

          const { data, error } = await supabase.rpc('v3_place_bid', {
            p_auction_id: auction.id,
            p_lot_id: lot.id,
            p_team_id: bid.teamId,
            p_request_id: requestId,
            p_is_bot: true
          });

          console.log(`\nAUCTION_TICK\nauction=${auction.id}\nlot=${lot.id}\nphase=BIDDING\naction=BOT_BID\nteam=${bid.teamId}\namount=${bid.nextBidAmount}\nresult=${error ? 'FAILED' : 'APPLIED'}`);
          actionsTaken.push({ auction: auction.id, lot: lot.id, action: 'BOT_BID', team: bid.teamId, amount: bid.nextBidAmount, error: error?.message });

          // Only one bid per tick to avoid race conditions and simulate human delay
          break;
        }
      }
    }

    return NextResponse.json({ success: true, actions: actionsTaken });
  } catch (err: any) {
    console.error('[AUCTION TICK ERROR]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
