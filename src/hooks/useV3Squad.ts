import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { V3Player } from '@/lib/v3-auction-types';

export interface V3SquadPlayer {
  lot_id: string;
  winning_bid: number;
  winning_team_id: string;
  player: V3Player;
}

export function useV3Squad(auctionId: string | null) {
  const [squadPlayers, setSquadPlayers] = useState<V3SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  const fetchSquads = useCallback(async () => {
    if (!auctionId) return;
    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('auction_lots')
        .select(`
          id,
          winning_bid,
          winning_team_id,
          player:players(*)
        `)
        .eq('auction_id', auctionId)
        .eq('status', 'SOLD');

      if (fetchError) throw fetchError;

      if (mountedRef.current && data) {
        // Map the joined data to our structured interface
        const players: V3SquadPlayer[] = data.map((d: any) => ({
          lot_id: d.id,
          winning_bid: d.winning_bid,
          winning_team_id: d.winning_team_id,
          player: Array.isArray(d.player) ? d.player[0] : d.player
        }));
        setSquadPlayers(players);
      }
    } catch (err: any) {
      console.error('Error fetching squad data:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch squad data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [auctionId, supabase]);

  useEffect(() => {
    mountedRef.current = true;
    if (auctionId) {
      fetchSquads();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [auctionId, fetchSquads]);

  // Realtime Subscription
  useEffect(() => {
    if (!auctionId) return;

    let refreshTimeout: NodeJS.Timeout | null = null;
    const triggerRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (mountedRef.current) {
          fetchSquads();
        }
      }, 500); // 500ms debounce
    };

    const channel = supabase.channel(`v3_squad_${auctionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auction_lots',
        filter: `auction_id=eq.${auctionId}`
      }, (payload) => {
        const updatedLot = payload.new;
        // Only trigger refresh if it becomes SOLD or if it's already SOLD and was updated (unlikely, but safe)
        if (updatedLot.status === 'SOLD') {
          triggerRefresh();
        }
      })
      .subscribe();

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [auctionId, fetchSquads, supabase]);

  return { squadPlayers, loading, error, refresh: fetchSquads };
}
