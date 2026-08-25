import React from 'react';
import { V3Player } from '@/lib/v3-auction-types';

interface V3PlayerCardProps {
  player: V3Player;
}

export function V3PlayerCard({ player }: V3PlayerCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#2A312D] bg-gradient-to-b from-[#141917] to-[#0B0F0D] p-6 shadow-2xl flex flex-col sm:flex-row gap-6">
      <div className="flex-shrink-0 w-32 h-32 sm:w-48 sm:h-48 rounded-2xl bg-[#0B0F0D] border-2 border-[#2A312D] flex items-center justify-center overflow-hidden">
        {player.image_url ? (
          <img src={player.image_url} alt={player.name} className="w-full h-full object-cover opacity-90" />
        ) : (
          <span className="text-4xl font-display text-[#2A312D] uppercase tracking-widest">{player.name.substring(0, 2)}</span>
        )}
      </div>

      <div className="flex flex-col flex-1 justify-center space-y-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-[#F3F4F1] font-display tracking-tight leading-none mb-1">
            {player.name}
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-[#1E2522] border border-[#2A312D] text-xs font-mono font-bold text-[#E4B93F]">
              {player.role}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#1E2522] border border-[#2A312D] text-xs font-mono font-bold text-[#9CA6A0]">
              {player.country} {player.is_overseas && '(OVERSEAS)'}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#1E2522] border border-[#2A312D] text-xs font-mono font-bold text-[#9CA6A0]">
              SET: {player.category}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-12 pt-4 border-t border-[#2A312D]/50">
          <div>
            <p className="text-[10px] font-mono font-bold text-[#9CA6A0] uppercase tracking-widest mb-1">BASE PRICE</p>
            <p className="text-2xl font-mono-numbers font-bold text-[#F3F4F1]">
              ₹{player.base_price} <span className="text-sm text-[#9CA6A0]">LAKH</span>
            </p>
          </div>
          {player.age && (
            <div>
              <p className="text-[10px] font-mono font-bold text-[#9CA6A0] uppercase tracking-widest mb-1">AGE</p>
              <p className="text-lg font-mono-numbers text-[#F3F4F1]">{player.age}</p>
            </div>
          )}
          {player.batting_hand && (
            <div>
              <p className="text-[10px] font-mono font-bold text-[#9CA6A0] uppercase tracking-widest mb-1">BATTING</p>
              <p className="text-lg font-mono-numbers text-[#F3F4F1]">{player.batting_hand}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
