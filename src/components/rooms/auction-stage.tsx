'use client';

// src/components/rooms/auction-stage.tsx
// Prominent Central Auction Stage Podium for Live Cricket Control Room
import React from 'react';
import { AuctionPlayerCard, CurrentPlayer } from './auction-player-card';
import { Gavel, Radio, Sparkles, Shield } from 'lucide-react';

export interface AuctionStageProps {
  currentPlayer?: CurrentPlayer | null;
  currentBidCr?: number | null;
  leadingTeamName?: string | null;
  roomName?: string;
  isHost?: boolean;
}

export function AuctionStage({
  currentPlayer,
  currentBidCr,
  leadingTeamName,
  roomName = 'IPL MEGA DRAFT',
  isHost = false,
}: AuctionStageProps) {
  return (
    <div className="w-full flex flex-col h-full space-y-6">
      {/* Prominent Stage Header Podium Banner */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#141917] border-2 border-[#2A312D] shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* PROMINENT GAVEL & PODIUM GRAPHIC */}
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0B0F0D] border-2 border-[#C9A227] flex items-center justify-center text-[#E4B93F] shadow-2xl relative flex-shrink-0 group">
            <Gavel className="w-9 h-9 sm:w-11 sm:h-11 text-[#C9A227]" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#141917] animate-pulse-live shadow-md" />
          </div>

          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <span className="text-[10px] font-mono-numbers font-extrabold text-[#C9A227] uppercase tracking-widest bg-[#0B0F0D] px-2.5 py-1 rounded-md border border-[#2A312D]">
                MAIN AUCTION PODIUM
              </span>
              <span className="text-xs font-mono-numbers font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/30">
                <Radio className="w-3.5 h-3.5" />
                <span>BROADCAST LIVE</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#F3F4F1] font-display uppercase tracking-wide">
              AUCTION READY
            </h2>
          </div>
        </div>

        {/* Stage Status Info */}
        <div className="flex items-center space-x-3 bg-[#0B0F0D] px-4 py-3 rounded-xl border-2 border-[#2A312D] text-xs font-mono-numbers font-bold text-[#E4B93F] self-stretch md:self-auto justify-center">
          <Sparkles className="w-4 h-4 text-[#C9A227]" />
          <span className="uppercase font-extrabold tracking-wide">{roomName} BROADCAST STAGE</span>
        </div>

      </div>

      {/* Main Auction Player Card */}
      <AuctionPlayerCard
        currentPlayer={currentPlayer}
        currentBidCr={currentBidCr}
        leadingTeamName={leadingTeamName}
        statusText={isHost ? 'READY TO START AUCTION' : 'WAITING FOR HOST TO START AUCTION'}
      />
    </div>
  );
}
