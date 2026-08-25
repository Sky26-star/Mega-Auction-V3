// src/components/summary/auction-overview-cards.tsx
// Top KPI Stat Cards for Auction Overview

import React from 'react';
import type { SummaryOverview } from '@/lib/summary/loader';
import { Trophy, DollarSign, Users, Clock, CheckCircle2, XCircle, TrendingUp, Award } from 'lucide-react';

interface AuctionOverviewCardsProps {
  overview: SummaryOverview;
}

export function AuctionOverviewCards({ overview }: AuctionOverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. TOTAL SPEND */}
      <div className="bg-[#0D1220] border border-amber-500/30 p-4 rounded-3xl space-y-1 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">TOTAL SPEND</span>
          <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="font-mono text-xl md:text-2xl font-black text-amber-300">
          ₹{overview.totalSpendCr.toFixed(2)} Cr
        </div>
        <span className="text-[9px] text-zinc-400 block font-mono">Gross Turnover</span>
      </div>

      {/* 2. PLAYERS SOLD */}
      <div className="bg-[#0D1220] border border-emerald-500/30 p-4 rounded-3xl space-y-1 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">PLAYERS SOLD</span>
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="font-mono text-xl md:text-2xl font-black text-emerald-300">
          {overview.soldCount} <span className="text-xs font-normal text-zinc-400">/ {overview.totalLots}</span>
        </div>
        <span className="text-[9px] text-zinc-400 block font-mono">
          Rd 1: {overview.round1SoldCount} | Rd 2: {overview.round2SoldCount}
        </span>
      </div>

      {/* 3. PLAYERS UNSOLD */}
      <div className="bg-[#0D1220] border border-red-500/30 p-4 rounded-3xl space-y-1 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest">UNSOLD</span>
          <div className="p-1.5 rounded-xl bg-red-500/10 text-red-400">
            <XCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="font-mono text-xl md:text-2xl font-black text-red-300">
          {overview.unsoldCount}
        </div>
        <span className="text-[9px] text-zinc-400 block font-mono">Passed Unsold Lots</span>
      </div>

      {/* 4. AVG PURCHASE PRICE */}
      <div className="bg-[#0D1220] border border-blue-500/30 p-4 rounded-3xl space-y-1 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest">AVG PRICE</span>
          <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="font-mono text-xl md:text-2xl font-black text-blue-300">
          ₹{overview.averagePurchasePriceCr.toFixed(2)} Cr
        </div>
        <span className="text-[9px] text-zinc-400 block font-mono">Mean Sold Value</span>
      </div>

      {/* 5. HIGHEST BID */}
      <div className="bg-[#0D1220] border border-amber-500/40 p-4 rounded-3xl space-y-1 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-widest">TOP BUY</span>
          <div className="p-1.5 rounded-xl bg-amber-400/10 text-amber-300">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="font-mono text-xl md:text-2xl font-black text-amber-200">
          ₹{overview.highestPurchaseCr.toFixed(2)} Cr
        </div>
        <span className="text-[9px] text-zinc-400 block font-mono">Highest Purchase</span>
      </div>

      {/* 6. DURATION */}
      <div className="bg-[#0D1220] border border-purple-500/30 p-4 rounded-3xl space-y-1 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest">DURATION</span>
          <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="font-mono text-xl md:text-2xl font-black text-purple-300">
          {overview.durationMinutes} <span className="text-xs font-normal text-zinc-400">min</span>
        </div>
        <span className="text-[9px] text-zinc-400 block font-mono">Auction Runtime</span>
      </div>
    </div>
  );
}
