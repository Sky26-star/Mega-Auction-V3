// src/components/summary/team-purse-matrix.tsx
// Team Purse Utilization Matrix & Financial Breakdown

import React from 'react';
import type { SummaryTeamData } from '@/lib/summary/loader';
import { Bot, User, Globe, Users } from 'lucide-react';

interface TeamPurseMatrixProps {
  teams: SummaryTeamData[];
  onSelectTeam?: (teamId: string) => void;
}

export function TeamPurseMatrix({ teams, onSelectTeam }: TeamPurseMatrixProps) {
  return (
    <div className="bg-[#0D1220] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="font-mono text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
          TEAM PURSE UTILIZATION & SQUAD MATRIX
        </h3>
        <span className="text-[10px] font-mono text-zinc-400 uppercase">
          {teams.length} Participating Franchises
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {teams.map((team) => {
          const spendPct = Math.min(100, Math.round((team.totalSpentCr / team.initialPurseCr) * 100));
          const squadPct = Math.min(100, Math.round((team.playersBought / team.maxSquadSize) * 100));

          return (
            <div
              key={team.id}
              onClick={() => onSelectTeam && onSelectTeam(team.id)}
              className="bg-[#141A2D] border border-white/5 hover:border-purple-500/40 p-4 rounded-2xl space-y-3 cursor-pointer transition-all hover:bg-[#182038] shadow-md group"
            >
              {/* Team Identity */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: team.color }}
                  ></div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">
                        {team.name}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400 font-bold">({team.shortName})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {team.isBot ? (
                    <span className="bg-blue-950/60 border border-blue-500/40 text-blue-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Bot className="w-3 h-3" /> BOT
                    </span>
                  ) : (
                    <span className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <User className="w-3 h-3" /> HUMAN
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Progress Bar */}
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-400">PURSE SPENT ({spendPct}%)</span>
                  <span className="text-amber-300 font-bold">₹{team.totalSpentCr.toFixed(2)} Cr / ₹{team.initialPurseCr.toFixed(2)} Cr</span>
                </div>
                <div className="w-full bg-[#0D1220] h-2 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${spendPct}%` }}
                  ></div>
                </div>
              </div>

              {/* Roster & Purse Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0D1220] p-2.5 rounded-xl border border-white/5 font-mono text-[10px]">
                <div>
                  <span className="text-zinc-500 block uppercase">REMAINING</span>
                  <span className="font-black text-emerald-400 text-xs">₹{team.remainingPurseCr.toFixed(2)} Cr</span>
                </div>
                <div>
                  <span className="text-zinc-500 block uppercase">AVG BUY</span>
                  <span className="font-black text-blue-300 text-xs">₹{team.avgPurchasePriceCr.toFixed(2)} Cr</span>
                </div>
                <div>
                  <span className="text-zinc-500 block uppercase">SQUAD SIZE</span>
                  <span className="font-bold text-white text-xs flex items-center gap-1">
                    <Users className="w-3 h-3 text-zinc-400" /> {team.playersBought} / {team.maxSquadSize}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block uppercase">OVERSEAS</span>
                  <span className="font-bold text-indigo-300 text-xs flex items-center gap-1">
                    <Globe className="w-3 h-3 text-indigo-400" /> {team.overseasCount} / {team.maxOverseas}
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
