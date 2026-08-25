import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { V3AuctionState, V3Auction, V3AuctionLot, V3Team, V3Player } from '@/lib/v3-auction-types';

export function useV3AuctionState(roomId: string) {
  const [state, setState] = useState<V3AuctionState>({
    auction: null,
    currentLot: null,
    currentPlayer: null,
    teams: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animation, setAnimation] = useState<{
    status: 'SOLD' | 'UNSOLD';
    lot: V3AuctionLot;
    player: V3Player;
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const mountedRef = useRef(true);
  const lastAnimatedLotIdRef = useRef<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!roomId) return;
    try {
      setError(null);

      // 1. Fetch Auction
      const { data: auctionData, error: auctionError } = await supabase
        .from('auctions')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (auctionError) throw auctionError;
      if (!auctionData) throw new Error('Auction not found for room');

      const auction: V3Auction = auctionData;

      // 2. Fetch Teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('auction_id', auction.id)
        .order('name');

      if (teamsError) throw teamsError;

      // 3. Fetch Current Lot and Player (if active)
      let currentLot: V3AuctionLot | null = null;
      let currentPlayer: V3Player | null = null;

      if (auction.current_lot_id) {
        const { data: lotData, error: lotError } = await supabase
          .from('auction_lots')
          .select('*')
          .eq('id', auction.current_lot_id)
          .single();

        if (lotError && lotError.code !== 'PGRST116') throw lotError; // PGRST116 is no rows

        if (lotData) {
          currentLot = lotData;

          const { data: playerData, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('id', lotData.player_id)
            .single();

          if (playerError) throw playerError;
          currentPlayer = playerData;
        }
      }

      if (mountedRef.current) {
        console.log('[ V3 FETCH ]');
        console.log('returned current lot id', currentLot?.id);
        console.log('returned current lot status', currentLot?.status);
        console.log('returned next lot id', 'N/A'); // The hook just fetches currentLot, it doesn't know the future next lot until it becomes currentLot

        let calcDiff: number | null = null;
        if (currentLot?.timer_expires_at) {
          calcDiff = Math.max(0, new Date(currentLot.timer_expires_at).getTime() - Date.now());
        }

        console.log(`\n[BOT TIMER TRACE] AFTER FETCH
lot_id: ${currentLot?.id}
DB timer_expires_at: ${currentLot?.timer_expires_at || 'N/A'}
client Date.now(): ${Date.now()}
calculated remaining ms: ${calcDiff !== null ? calcDiff : 'N/A'}
rendered remaining seconds: ${calcDiff !== null ? Math.ceil(calcDiff / 1000) : 'N/A'}\n`);

        setState({
          auction,
          currentLot,
          currentPlayer,
          teams: teamsData || []
        });
      }
    } catch (err: any) {
      console.error('Error fetching V3 auction state:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch auction state');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [roomId, supabase]);

  useEffect(() => {
    mountedRef.current = true;

    if (roomId) {
      fetchState();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [roomId, fetchState]);

  const triggerAnimation = useCallback(async (lotId: string, knownLot?: V3AuctionLot) => {
    if (lastAnimatedLotIdRef.current === lotId) return;
    lastAnimatedLotIdRef.current = lotId;

    try {
      let lot = knownLot;
      if (!lot) {
        const { data } = await supabase.from('auction_lots').select('*').eq('id', lotId).single();
        lot = data;
      }

      if (!lot || (lot.status !== 'SOLD' && lot.status !== 'UNSOLD')) {
        lastAnimatedLotIdRef.current = null;
        return;
      }

      const { data: player } = await supabase.from('players').select('*').eq('id', lot.player_id).single();

      if (player && mountedRef.current) {
        setAnimation({ status: lot.status as 'SOLD' | 'UNSOLD', lot, player });

        setTimeout(() => {
          if (mountedRef.current) {
            setAnimation(null);
          }
        }, 3000);
      } else {
        lastAnimatedLotIdRef.current = null;
      }
    } catch (err) {
      console.error('Failed to trigger animation authoritatively', err);
      lastAnimatedLotIdRef.current = null;
    }
  }, [supabase]);


  // Realtime Subscriptions
  useEffect(() => {
    if (!roomId || !state.auction?.id) return;

    const auctionId = state.auction.id;
    let refreshTimeout: NodeJS.Timeout | null = null;

    console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | Channel creation | auction_id: ${auctionId} | dependencies changed, recreating channel`);

    // Debounced refresh to avoid rapid re-renders if many events fire at once
    const triggerRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (mountedRef.current) {
          fetchState();
        }
      }, 200);
    };

    const channel = supabase.channel(`v3_auction_${auctionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'auctions',
        filter: `id=eq.${auctionId}`
      }, () => {
        triggerRefresh();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auction_lots',
        filter: `auction_id=eq.${auctionId}`
      }, async (payload) => {
        const updatedLot = payload.new as V3AuctionLot;
        const oldLot = payload.old as any;
        console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | auction_lots UPDATE callback | auction_id: ${auctionId} | lot_id: ${updatedLot.id} | previous status: ${oldLot?.status} | new status: ${updatedLot.status}`);

        // Intercept SOLD / UNSOLD for animation
        if (updatedLot.status === 'SOLD' || updatedLot.status === 'UNSOLD') {
          triggerAnimation(updatedLot.id, updatedLot);
        }

        // Apply state instantly to avoid fetch delays/caching issues for timers
        if (mountedRef.current) {
          setState(prev => {
            if (prev.currentLot?.id === updatedLot.id) {
              return {
                ...prev,
                currentLot: {
                  ...prev.currentLot,
                  ...updatedLot
                }
              };
            }
            return prev;
          });
        }

        // Only refresh if it's the current lot OR the auction state is transitioning
        // We can just trigger refresh to be safe and authoritative.
        triggerRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `auction_id=eq.${auctionId}`
      }, () => {
        triggerRefresh();
      })
      .subscribe((status) => {
        console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | subscribe() status: ${status} | auction_id: ${auctionId}`);
        if (status === 'SUBSCRIBED') {
          console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | SUBSCRIBED | auction_id: ${auctionId}`);
          // Sync state just in case we missed events while subscribing
          triggerRefresh();
        } else if (status === 'CHANNEL_ERROR') {
          console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | CHANNEL_ERROR | auction_id: ${auctionId}`);
        } else if (status === 'TIMED_OUT') {
          console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | TIMED_OUT | auction_id: ${auctionId}`);
        } else if (status === 'CLOSED') {
          console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | CLOSED | auction_id: ${auctionId}`);
        }
      });

    return () => {
      console.log(`[ REALTIME DIAGNOSTIC ] ${Date.now()} | Channel cleanup/unsubscribe | auction_id: ${auctionId}`);
      if (refreshTimeout) clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [roomId, state.auction?.id, fetchState, supabase, triggerAnimation]);

  return {
    state,
    loading,
    error,
    refresh: fetchState,
    animation,
    triggerAnimation
  };
}
