import React, { useState } from 'react';
import { V3AuctionLot, V3Team } from '@/lib/v3-auction-types';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

interface V3BidPanelProps {
  lot: V3AuctionLot;
  teams: V3Team[];
  myTeam: V3Team | null;
  auctionId: string;
  onBidSuccess?: () => void;
}

export function V3BidPanel({ lot, teams, myTeam, auctionId, onBidSuccess }: V3BidPanelProps) {
  const [isBidding, setIsBidding] = useState(false);

  const highestBidder = teams.find((t) => t.id === lot.highest_bidder_team_id);
  const isMyBid = myTeam?.id === lot.highest_bidder_team_id;

  const handleBid = async () => {
    if (!myTeam || isBidding) return;

    setIsBidding(true);
    try {
      const supabase = createClient();
      const requestId = crypto.randomUUID();

      const { data, error } = await supabase.rpc('v3_place_bid', {
        p_auction_id: auctionId,
        p_lot_id: lot.id,
        p_team_id: myTeam.id,
        p_request_id: requestId
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to place bid');
      }

      onBidSuccess?.();
    } catch (err: any) {
      console.error('Bid error:', err);
      alert(err.message || 'Failed to place bid');
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <div className="flex flex-col border-2 border-[#2A312D] rounded-3xl bg-[#0B0F0D] overflow-hidden">
      <div className="flex flex-col sm:flex-row items-center justify-between p-6 sm:p-8 bg-gradient-to-r from-[#141917] to-[#1E2522]">

        <div className="flex flex-col space-y-2 text-center sm:text-left mb-6 sm:mb-0">
          <span className="text-xs font-mono font-bold text-[#9CA6A0] uppercase tracking-widest">
            {lot.status === 'GET_READY' ? 'STARTING BID' : 'CURRENT BID'}
          </span>
          <div className="text-5xl sm:text-6xl font-mono-numbers font-black text-[#E4B93F] drop-shadow-md">
            ₹{lot.current_bid} <span className="text-2xl text-[#E4B93F]/70">L</span>
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-end">
          {highestBidder ? (
            <div className="text-center sm:text-right">
              <span className="text-xs font-mono font-bold text-[#9CA6A0] uppercase tracking-widest block mb-2">
                HIGHEST BIDDER
              </span>
              <div className="flex items-center space-x-3 bg-[#0B0F0D] px-4 py-2 rounded-xl border border-[#2A312D]">
                <span className={`font-display font-bold text-lg uppercase ${isMyBid ? 'text-[#10B981]' : 'text-[#F3F4F1]'}`}>
                  {highestBidder.name}
                </span>
                {isMyBid && (
                  <span className="px-2 py-0.5 rounded-md bg-[#10B981]/20 text-[#10B981] text-[10px] font-mono font-bold">
                    YOU
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center sm:text-right">
              <span className="text-xs font-mono font-bold text-[#9CA6A0] uppercase tracking-widest block mb-2">
                HIGHEST BIDDER
              </span>
              <div className="px-4 py-2 rounded-xl border border-dashed border-[#2A312D] text-[#8B938E] font-mono text-sm">
                NO BIDS YET
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 bg-[#0B0F0D] flex justify-center border-t border-[#2A312D]">
        {myTeam ? (
          lot.status === 'BIDDING' ? (
            <button
              onClick={handleBid}
              disabled={isBidding || isMyBid}
              className={`w-full max-w-md py-4 rounded-2xl font-mono font-black text-xl uppercase tracking-wider transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg
                ${isMyBid
                  ? 'bg-[#10B981]/20 border-2 border-[#10B981]/40 text-[#10B981] cursor-not-allowed opacity-80'
                  : isBidding
                    ? 'bg-[#E4B93F]/50 border-2 border-[#E4B93F] text-white cursor-not-allowed'
                    : 'bg-[#E4B93F] hover:bg-[#C9A227] hover:scale-[1.02] active:scale-95 text-[#0B0F0D] border-2 border-[#E4B93F]'
                }`}
            >
              {isBidding ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>PLACING BID...</span>
                </>
              ) : isMyBid ? (
                <span>YOU ARE LEADING</span>
              ) : (
                <span>PLACE BID</span>
              )}
            </button>
          ) : lot.status === 'GET_READY' ? (
             <div className="w-full max-w-md py-4 rounded-2xl font-mono font-black text-xl uppercase tracking-wider bg-[#1E2522] text-[#9CA6A0] border-2 border-[#2A312D] text-center flex items-center justify-center space-x-2">
               <Loader2 className="w-5 h-5 animate-spin" />
               <span>GET READY...</span>
             </div>
          ) : (
             <div className="w-full max-w-md py-4 rounded-2xl font-mono font-black text-xl uppercase tracking-wider bg-[#1E2522] text-[#9CA6A0] border-2 border-[#2A312D] text-center">
               AUCTION PAUSED
             </div>
          )
        ) : (
          <div className="w-full max-w-md py-4 rounded-2xl font-mono text-sm uppercase tracking-wider bg-[#1E2522] text-[#9CA6A0] border border-dashed border-[#2A312D] text-center">
            You are viewing as an observer (No Team)
          </div>
        )}
      </div>
    </div>
  );
}
