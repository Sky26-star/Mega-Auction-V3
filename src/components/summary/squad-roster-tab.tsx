// src/components/summary/squad-roster-tab.tsx
// Interactive Team Squad Roster Inspection

import React, { useState } from 'react';
import type { SummaryTeamData, SummaryPlayerItem } from '@/lib/summary/loader';
import { Shield, Globe, Award, Sparkles, UserCheck } from 'lucide-react';

interface SquadRosterTabProps {
  teams: SummaryTeamData[];
  selectedTeamId?: string;
}

export function SquadRosterTab({ teams, selectedTeamId }: SquadRosterTabProps) {
  const [activeTeamId, setActiveTeamId] = useState<string>(selectedTeamId || teams[0]?.id || '');

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];

  if (!activeTeam) {
    return null;
  }

  return (
    <div className="bg-[#0D1220] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="font-mono text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          TEAM SQUAD ROSTERS ({teams.length} TEAMS)
        </h3>
        <span className="text-[10px] font-mono text-zinc-400 uppercase">
          {activeTeam.squad.length} Players Acquired
        </span>
      </div>

      {/* Team Tabs Header */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
        {teams.map((team) => {
          const isActive = team.id === activeTeamId;
          return (
            <button
              key={team.id}
              onClick={() => setActiveTeamId(team.id)}
              className={`py-2 px-3 rounded-2xl font-mono text-xs font-bold uppercase transition-all whitespace-nowrap flex items-center gap-2 border ${
                isActive
                  ? 'bg-purple-600 border-purple-400 text-white shadow-lg scale-105'
                  : 'bg-[#141A2D] border-white/5 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/20"
                style={{ backgroundColor: team.color }}
              ></span>
              <span>{team.shortName}</span>
              <span className="text-[10px] opacity-75 font-normal">({team.playersBought})</span>
            </button>
          );
        })}
      </div>

      {/* Active Team Header Info Banner */}
      <div className="bg-[#141A2D] border border-purple-500/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center font-black text-white text-xs shadow-md"
            style={{ backgroundColor: activeTeam.color }}
          >
            {activeTeam.shortName}
          </div>
          <div>
            <h4 className="font-bold text-white text-base">{activeTeam.name}</h4>
            <span className="text-[10px] text-zinc-400 block">
              {activeTeam.isBot ? '🤖 AI Bot Managed Franchise' : '👤 Human Managed Franchise'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[8px] text-zinc-500 block uppercase">TOTAL SPENT</span>
            <span className="font-black text-amber-300">₹{activeTeam.totalSpentCr.toFixed(2)} Cr</span>
          </div>
          <div className="h-6 w-px bg-white/10"></div>
          <div>
            <span className="text-[8px] text-zinc-500 block uppercase">PURSE LEFT</span>
            <span className="font-black text-emerald-400">₹{activeTeam.remainingPurseCr.toFixed(2)} Cr</span>
          </div>
          <div className="h-6 w-px bg-white/10"></div>
          <div>
            <span className="text-[8px] text-zinc-500 block uppercase">OVERSEAS</span>
            <span className="font-bold text-indigo-300">{activeTeam.overseasCount} / {activeTeam.maxOverseas}</span>
          </div>
        </div>
      </div>

      {/* Squad Roster Player List */}
      {activeTeam.squad.length === 0 ? (
        <div className="p-8 bg-[#141A2D] rounded-2xl text-center font-mono text-zinc-500 text-xs border border-white/5 space-y-2">
          <UserCheck className="w-6 h-6 mx-auto text-zinc-600" />
          <p>No players acquired by {activeTeam.name} during this auction.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {activeTeam.squad.map((player, idx) => (
            <div
              key={player.squadPlayerId || player.id || idx}
              className="bg-[#141A2D] border border-white/5 hover:border-purple-500/30 p-3 rounded-2xl flex items-center justify-between font-mono transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-xs font-bold w-4 text-right">{idx + 1}.</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">{player.name}</span>
                    {player.isOverseas && (
                      <span className="bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[8px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" /> OS
                      </span>
                    )}
                    {player.isUnsoldRound && (
                      <span className="bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[8px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> RD 2
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 block">
                    {player.role} • {player.category} ({player.country})
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
  );
}
