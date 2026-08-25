import React from 'react';
import { V3Team, V3AuctionLot } from '@/lib/v3-auction-types';
import { Users, Wallet } from 'lucide-react';

interface V3TeamsProps {
  teams: V3Team[];
  lot: V3AuctionLot | null;
}

export function V3Teams({ teams, lot }: V3TeamsProps) {
  // Sort teams by purse remaining, descending
  const sortedTeams = [...teams].sort((a, b) => b.purse - a.purse);

  return (
    <div className="bg-[#0B0F0D] border-2 border-[#2A312D] rounded-3xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-mono font-bold text-[#F3F4F1] uppercase tracking-widest flex items-center space-x-2">
          <Users className="w-4 h-4 text-[#C9A227]" />
          <span>FRANCHISES</span>
        </h3>
        <span className="text-xs font-mono text-[#9CA6A0] bg-[#141917] px-3 py-1 rounded-lg border border-[#2A312D]">
          {teams.length} TEAMS
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {sortedTeams.map((team) => {
          const isHighestBidder = lot?.highest_bidder_team_id === team.id;

          return (
            <div
              key={team.id}
              className={`p-4 rounded-2xl border-2 transition-all duration-300 ${
                isHighestBidder
                  ? 'bg-[#141917] border-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.1)] transform -translate-y-1'
                  : 'bg-[#141917] border-[#2A312D]'
              }`}
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#0B0F0D] border border-[#2A312D] flex items-center justify-center overflow-hidden flex-shrink-0">
                  <span className="text-[10px] font-display text-[#8B938E]">{team.short_name}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-display font-bold text-[#F3F4F1] truncate uppercase">
                    {team.name}
                  </h4>
                  {isHighestBidder && (
                    <span className="text-[9px] font-mono font-bold text-[#10B981] uppercase tracking-wider block">
                      LEADING BID
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center bg-[#0B0F0D] p-2 rounded-lg border border-[#2A312D]">
                  <span className="text-[10px] font-mono text-[#9CA6A0] uppercase flex items-center">
                    <Wallet className="w-3 h-3 mr-1" /> PURSE
                  </span>
                  <span className="font-mono-numbers font-bold text-[#E4B93F] text-sm">
                    ₹{team.purse}L
                  </span>
                </div>

                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-mono text-[#9CA6A0] uppercase">SQUAD</span>
                  <span className="font-mono-numbers text-xs text-[#F3F4F1]">
                    {team.players_bought} <span className="text-[#8B938E]">({team.overseas_count} OS)</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
