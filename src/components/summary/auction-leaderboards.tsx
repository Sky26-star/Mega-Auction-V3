// src/components/summary/auction-leaderboards.tsx
// Top Purchases & Unsold Player Catalog

import React from 'react';
import type { SummaryPlayerItem } from '@/lib/summary/loader';
import { Crown, AlertTriangle, Flame, Sparkles } from 'lucide-react';

interface AuctionLeaderboardsProps {
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
  }[];
}

export function AuctionLeaderboards({ topBuys, unsoldLots }: AuctionLeaderboardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono">
      {/* 1. TOP PURCHASES LEADERBOARD */}
      <div className="bg-[#0D1220] border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            TOP 5 MOST EXPENSIVE PURCHASES
          </h3>
          <span className="text-[10px] text-amber-400 font-bold">MARQUEE BUYS</span>
        </div>

        {topBuys.length === 0 ? (
          <p className="text-zinc-500 text-xs text-center py-6">No purchases completed in this auction.</p>
        ) : (
          <div className="space-y-2.5">
            {topBuys.map((player, idx) => (
              <div
                key={player.squadPlayerId || player.id || idx}
                className="bg-[#141A2D] border border-amber-500/20 p-3 rounded-2xl flex items-center justify-between shadow-sm hover:border-amber-400/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                      idx === 0
                        ? 'bg-amber-400 text-black shadow-md shadow-amber-500/30'
                        : idx === 1
                        ? 'bg-zinc-300 text-black'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-white/10 text-zinc-400'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{player.name}</span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.2 rounded text-white"
                        style={{ backgroundColor: player.teamColor || '#6B7280' }}
                      >
                        {player.teamName}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block">
                      {player.role} • {player.country}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-black text-amber-300 text-sm block">
                    ₹{player.purchasePriceCr.toFixed(2)} Cr
                  </span>
                  <span className="text-[8px] text-zinc-500 uppercase block">
                    Base: ₹{player.basePriceCr.toFixed(2)} Cr
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. UNSOLD PLAYER CATALOG */}
      <div className="bg-[#0D1220] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-zinc-400" />
            UNSOLD PLAYER CATALOG ({unsoldLots.length})
          </h3>
          <span className="text-[10px] text-zinc-400 uppercase">PASSED LOTS</span>
        </div>

        {unsoldLots.length === 0 ? (
          <div className="p-8 bg-[#141A2D] rounded-2xl text-center text-zinc-400 text-xs border border-white/5 space-y-1">
            <Sparkles className="w-5 h-5 mx-auto text-emerald-400" />
            <p className="font-bold text-white">100% SOLD OUT!</p>
            <p className="text-[10px] text-zinc-500">All player lots were successfully acquired by participating teams.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {unsoldLots.map((lot, idx) => (
              <div
                key={lot.id || idx}
                className="bg-[#141A2D] border border-white/5 p-3 rounded-2xl flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs font-bold">LOT #{lot.lotIndex + 1}</span>
                    <span className="font-bold text-zinc-200 text-sm">{lot.playerName}</span>
                    {lot.isUnsoldRound && (
                      <span className="bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[8px] font-bold px-1.5 py-0.2 rounded">
                        RD 2
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    {lot.role} • {lot.category} ({lot.country})
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-bold text-zinc-400 text-xs block">
                    ₹{lot.basePriceCr.toFixed(2)} Cr
                  </span>
                  <span className="text-[8px] text-red-400 uppercase block font-bold">UNSOLD</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
