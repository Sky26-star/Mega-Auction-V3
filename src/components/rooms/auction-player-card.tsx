'use client';

// src/components/rooms/auction-player-card.tsx
// Refined High-Impact Broadcast Player Card for Live Cricket Auction Control Room
import React from 'react';
import Image from 'next/image';
import { Gavel, Clock, ShieldAlert, Trophy, Coins, Sparkles } from 'lucide-react';

export interface CurrentPlayer {
  id?: string;
  lotNumber?: string;
  name: string;
  role: string;
  category?: string;
  basePriceCr: number; // In Crores (e.g. 2.0)
  imageUrl?: string | null;
  status?: string;
}

export interface AuctionPlayerCardProps {
  currentPlayer?: CurrentPlayer | null;
  currentBidCr?: number | null;
  leadingTeamName?: string | null;
  statusText?: string;
  isBiddingActive?: boolean;
}

export function AuctionPlayerCard({
  currentPlayer,
  currentBidCr,
  leadingTeamName,
  statusText = 'WAITING FOR AUCTION TO START',
  isBiddingActive = false,
}: AuctionPlayerCardProps) {
  // Default preview player (MS Dhoni preview asset used as visual demo fallback)
  const player = currentPlayer || {
    lotNumber: 'LOT #014',
    name: 'MS DHONI',
    role: 'WICKETKEEPER BATTER',
    category: 'MARQUEE',
    basePriceCr: 2.0,
    imageUrl: '/images/ms_dhoni.jpg',
    status: 'UP NEXT',
  };

  const lotTag = player.lotNumber || 'LOT #014';
  const categoryTag = player.category || 'MARQUEE';
  const displayImage = player.imageUrl || '/images/ms_dhoni.jpg';
  const formattedBasePrice = `₹${player.basePriceCr.toFixed(2)} Cr`;
  const formattedCurrentBid = currentBidCr ? `₹${currentBidCr.toFixed(2)} Cr` : formattedBasePrice;

  return (
    <div className="w-full flex-1 rounded-2xl bg-[#141917] border-2 border-[#2A312D] p-5 sm:p-7 shadow-2xl relative overflow-hidden transition-all group flex flex-col justify-between">
      
      {/* Top Card Banner Bar */}
      <div className="flex items-center justify-between border-b border-[#2A312D] pb-4 mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-xs sm:text-sm font-mono-numbers font-black text-[#E4B93F] bg-[#0B0F0D] px-3.5 py-1.5 rounded-lg border-2 border-[#2A312D] tracking-wider uppercase shadow-inner">
            {lotTag}
          </span>
          <span className="text-xs font-mono-numbers font-extrabold text-[#C9A227] bg-[#C9A227]/15 px-3 py-1 rounded-lg border border-[#C9A227]/40 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E4B93F]" />
            <span>{categoryTag}</span>
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono-numbers font-bold text-[#9CA6A0] bg-[#0B0F0D] px-3 py-1 rounded-lg border border-[#2A312D]">
          <Clock className="w-4 h-4 text-[#C9A227]" />
          <span>STATUS: <strong className="text-[#F3F4F1] uppercase">{player.status || 'UP NEXT'}</strong></span>
        </div>
      </div>

      {/* Main Broadcast Player Profile Hero Frame */}
      <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 my-auto bg-[#0B0F0D] p-6 sm:p-8 rounded-2xl border-2 border-[#2A312D] relative overflow-hidden shadow-inner">
        
        {/* Subtle Background Lighting Accent */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#C9A227]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#B8322E]/5 rounded-full blur-3xl pointer-events-none" />

        {/* ENLARGED HERO PLAYER PORTRAIT FRAME */}
        <div className="relative w-44 h-44 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-2xl overflow-hidden border-4 border-[#C9A227] shadow-2xl flex-shrink-0 bg-[#141917] aspect-square group-hover:border-[#E4B93F] transition-all">
          <Image
            src={displayImage}
            alt={player.name}
            fill
            sizes="(max-width: 768px) 176px, 256px"
            className="object-cover object-top pointer-events-none"
            priority
          />
          {/* Subtle gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F0D] via-transparent to-transparent opacity-80 pointer-events-none" />
          <div className="absolute bottom-2 left-2 right-2 text-center">
            <span className="text-[10px] font-mono-numbers font-extrabold text-[#E4B93F] uppercase tracking-widest bg-[#0B0F0D]/90 px-2 py-0.5 rounded border border-[#C9A227]/50 backdrop-blur-sm">
              PREVIEW PLAYER
            </span>
          </div>
        </div>

        {/* Player Name, Role & Primary Stats */}
        <div className="flex-1 text-center md:text-left min-w-0 space-y-3.5">
          <div>
            <span className="text-xs font-mono-numbers font-extrabold text-[#C9A227] uppercase tracking-widest block mb-1">
              FEATURED PLAYER LOT
            </span>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#F3F4F1] font-display uppercase tracking-wide truncate drop-shadow-md">
              {player.name}
            </h2>
          </div>

          <div className="inline-block bg-[#181E1A] px-4 py-1.5 rounded-xl border-2 border-[#C9A227]/40 text-xs sm:text-sm font-bold text-[#E4B93F] uppercase tracking-wider shadow-sm">
            {player.role}
          </div>

          {/* Pricing Highlight Badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4">
            <div className="bg-[#141917] px-4 py-2.5 rounded-xl border border-[#2A312D]">
              <span className="text-[#9CA6A0] font-bold block text-[10px] uppercase tracking-widest mb-0.5">
                BASE PRICE
              </span>
              <span className="font-mono-numbers font-black text-xl sm:text-2xl text-[#E4B93F]">
                {formattedBasePrice}
              </span>
            </div>

            <div className="bg-[#141917] px-4 py-2.5 rounded-xl border border-[#2A312D]">
              <span className="text-[#9CA6A0] font-bold block text-[10px] uppercase tracking-widest mb-0.5">
                LOT STATUS
              </span>
              <span className="font-mono-numbers font-extrabold text-sm text-emerald-400 uppercase">
                {player.status || 'UP NEXT'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Valuation Grid */}
      <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-[#0B0F0D] border-2 border-[#2A312D] mt-6">
        <div>
          <span className="block text-[11px] font-mono-numbers font-bold text-[#9CA6A0] uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>OPENING BASE PRICE</span>
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono-numbers text-[#F3F4F1]">
            {formattedBasePrice}
          </span>
        </div>

        <div className="text-right">
          <span className="block text-[11px] font-mono-numbers font-bold text-[#E4B93F] uppercase tracking-widest mb-1 flex items-center justify-end gap-1.5">
            <span>STARTING BID</span>
            <Trophy className="w-3.5 h-3.5 text-[#E4B93F]" />
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono-numbers text-[#E4B93F]">
            {formattedCurrentBid}
          </span>
        </div>
      </div>

      {/* Stage Status Footer Banner */}
      <div className="mt-6 pt-4 border-t border-[#2A312D] flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-[#9CA6A0]">
          <ShieldAlert className="w-4 h-4 text-[#C9A227]" />
          <span className="font-mono-numbers font-bold text-[#F3F4F1] uppercase">
            {statusText}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono-numbers font-black text-[#C9A227] bg-[#0B0F0D] px-3 py-1.5 rounded-lg border border-[#2A312D]">
          <Gavel className="w-4 h-4 text-[#E4B93F]" />
          <span>BROADCAST STAGE READY</span>
        </div>
      </div>

    </div>
  );
}
