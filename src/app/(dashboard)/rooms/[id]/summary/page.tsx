'use client';

export const dynamic = 'force-dynamic';

// src/app/(dashboard)/rooms/[id]/summary/page.tsx
// Dedicated Authoritative Post-Auction Summary & Roster Analysis Page

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { loadAuctionSummaryData, type AuctionSummaryData } from '@/lib/summary/loader';
import { AuctionOverviewCards } from '@/components/summary/auction-overview-cards';
import { TeamPurseMatrix } from '@/components/summary/team-purse-matrix';
import { SquadRosterTab } from '@/components/summary/squad-roster-tab';
import { AuctionLeaderboards } from '@/components/summary/auction-leaderboards';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Trophy,
  Share2,
  CheckCircle2,
  RefreshCw,
  Home,
} from 'lucide-react';

import { SpendingAnalytics } from '@/components/summary/spending-analytics';

export default function PostAuctionSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id;
  const router = useRouter();

  const [summaryData, setSummaryData] = useState<AuctionSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: err } = await loadAuctionSummaryData(roomId);
    if (err) {
      setError(err);
    } else if (data) {
      setSummaryData(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (roomId) {
      fetchData();
    }
  }, [roomId]);

  return (
    <div className="min-h-screen bg-[#060911] text-zinc-100 flex flex-col font-sans">
      <Navbar />

      <div className="max-w-6xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/rooms/${roomId}`}
              className="p-2.5 rounded-2xl bg-[#141A2D] border border-white/10 hover:border-purple-400/40 text-zinc-300 hover:text-white transition-all shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ROOM #{summaryData?.overview.roomCode || '---'}
                </span>
                <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> AUCTION {summaryData?.overview.status || 'COMPLETED'}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white font-mono tracking-tight mt-1 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                POST-AUCTION SUMMARY & SQUAD ROSTER ANALYSIS
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-2xl bg-[#141A2D] border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all shadow-md"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/dashboard"
              className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all"
            >
              <Home className="w-4 h-4" /> DASHBOARD
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="p-16 rounded-3xl bg-[#0D1220] border border-white/10 text-center text-zinc-400 space-y-3 font-mono">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400" />
            <p className="text-xs">LOADING AUTHORITATIVE AUCTION SUMMARY & ROSTER DATA...</p>
          </div>
        ) : error ? (
          /* Error / Unauthorized State */
          <div className="p-8 rounded-3xl bg-red-950/40 border border-red-800/40 text-center text-red-300 space-y-4 font-mono">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
            <h3 className="font-bold text-base text-red-200">ACCESS RESTRICTED OR ERROR</h3>
            <p className="text-xs text-zinc-300 max-w-md mx-auto">{error}</p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-2xl bg-red-800 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-lg"
              >
                RETURN TO DASHBOARD
              </Link>
            </div>
          </div>
        ) : summaryData ? (
          /* Main Summary Presentation */
          <div className="space-y-6">
            {/* 1. Overview Stat Cards */}
            <AuctionOverviewCards overview={summaryData.overview} />

            {/* 2. Team Purse Utilization Matrix */}
            <TeamPurseMatrix
              teams={summaryData.teams}
              onSelectTeam={(teamId) => setSelectedTeamId(teamId)}
            />

            {/* 3. Comprehensive Spending & Distribution Analytics (PRD Item 6) */}
            <SpendingAnalytics
              overview={summaryData.overview}
              teams={summaryData.teams}
              categoryBreakdown={summaryData.categoryBreakdown}
              roleBreakdown={summaryData.roleBreakdown}
              domesticVsOverseas={summaryData.domesticVsOverseas}
            />

            {/* 4. Interactive Squad Roster Tabs */}
            <SquadRosterTab
              teams={summaryData.teams}
              selectedTeamId={selectedTeamId}
            />

            {/* 5. Auction Leaderboards & Unsold Catalog */}
            <AuctionLeaderboards
              topBuys={summaryData.topBuys}
              unsoldLots={summaryData.unsoldLots}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
