// src/components/summary/spending-analytics.tsx
// Comprehensive Spending Analytics, Role/Category Distribution & Data Export (PRD Item 6)

import React, { useState } from 'react';
import type {
  CategoryBreakdown,
  RoleBreakdown,
  DomesticVsOverseasBreakdown,
  SummaryTeamData,
  SummaryOverview,
} from '@/lib/summary/loader';
import { PieChart, BarChart3, Download, FileText, Globe, UserCheck, Layers, CheckCircle } from 'lucide-react';

interface SpendingAnalyticsProps {
  overview: SummaryOverview;
  teams: SummaryTeamData[];
  categoryBreakdown: CategoryBreakdown[];
  roleBreakdown: RoleBreakdown[];
  domesticVsOverseas: DomesticVsOverseasBreakdown;
}

export function SpendingAnalytics({
  overview,
  teams,
  categoryBreakdown,
  roleBreakdown,
  domesticVsOverseas,
}: SpendingAnalyticsProps) {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      'Team Name',
      'Team Code',
      'Player Name',
      'Role',
      'Category',
      'Country',
      'Is Overseas',
      'Base Price (Cr)',
      'Sold Price (Cr)',
      'Auction Round',
    ];

    const rows: string[][] = [];
    teams.forEach((team) => {
      team.squad.forEach((player) => {
        rows.push([
          `"${team.name}"`,
          `"${team.shortName}"`,
          `"${player.name}"`,
          `"${player.role}"`,
          `"${player.category}"`,
          `"${player.country}"`,
          player.isOverseas ? 'Yes' : 'No',
          player.basePriceCr.toFixed(2),
          player.purchasePriceCr.toFixed(2),
          player.isUnsoldRound ? 'Round 2' : 'Round 1',
        ]);
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MegaAuction_${overview.roomCode}_Summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('CSV Report downloaded successfully!');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  // JSON Export Handler
  const handleExportJSON = () => {
    const exportData = {
      roomCode: overview.roomCode,
      roomName: overview.roomName,
      exportedAt: new Date().toISOString(),
      overview,
      teams: teams.map((t) => ({
        name: t.name,
        shortName: t.shortName,
        isBot: t.isBot,
        initialPurseCr: t.initialPurseCr,
        totalSpentCr: t.totalSpentCr,
        remainingPurseCr: t.remainingPurseCr,
        playersBought: t.playersBought,
        overseasCount: t.overseasCount,
        squad: t.squad,
      })),
      categoryBreakdown,
      roleBreakdown,
      domesticVsOverseas,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `MegaAuction_${overview.roomCode}_Summary.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('JSON Data exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const totalSpent = overview.totalSpendCr || 1;

  return (
    <div className="bg-[#0D1220] border border-white/10 rounded-3xl p-5 space-y-5 shadow-xl font-mono">
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <PieChart className="w-4 h-4 text-purple-400" />
            AUCTION SPENDING & SQUAD DISTRIBUTION ANALYTICS
          </h3>
          <span className="text-[10px] text-zinc-400 block mt-0.5">
            Authoritative financial allocation across roles, categories, and player origins
          </span>
        </div>

        <div className="flex items-center gap-2">
          {downloadSuccess && (
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3 h-3 text-emerald-400" /> {downloadSuccess}
            </span>
          )}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-purple-950/80 border border-purple-500/40 hover:border-purple-400 text-purple-200 text-xs font-bold uppercase flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV EXPORT
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-xl bg-blue-950/80 border border-blue-500/40 hover:border-blue-400 text-blue-200 text-xs font-bold uppercase flex items-center gap-1.5 transition-all shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" /> JSON EXPORT
          </button>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. ROLE-WISE SPENDING BREAKDOWN */}
        <div className="bg-[#141A2D] border border-white/5 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" /> ROLE DISTRIBUTION
            </span>
            <span className="text-[9px] text-zinc-500 uppercase">{roleBreakdown.length} Roles</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {roleBreakdown.map((r) => (
              <div key={r.role} className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-300 font-bold uppercase">{r.role}</span>
                  <span className="text-amber-300 font-black">
                    ₹{r.totalSpentCr.toFixed(2)} Cr ({r.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-[#0D1220] h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, r.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. CATEGORY-WISE SPENDING BREAKDOWN */}
        <div className="bg-[#141A2D] border border-white/5 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> CATEGORY ALLOCATION
            </span>
            <span className="text-[9px] text-zinc-500 uppercase">{categoryBreakdown.length} Categories</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {categoryBreakdown.map((c) => (
              <div key={c.category} className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-300 font-bold uppercase">{c.category}</span>
                  <span className="text-purple-300 font-black">
                    ₹{c.totalSpentCr.toFixed(2)} Cr ({c.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-[#0D1220] h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, c.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. DOMESTIC VS OVERSEAS ALLOCATION */}
        <div className="bg-[#141A2D] border border-white/5 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" /> DOMESTIC VS OVERSEAS
            </span>
            <span className="text-[9px] text-zinc-500 uppercase">Player Origin</span>
          </div>

          <div className="space-y-3 text-xs pt-1">
            {/* Domestic */}
            <div className="bg-[#0D1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-bold">DOMESTIC (INDIA)</span>
                <span className="text-xs text-white font-bold">{domesticVsOverseas.domesticCount} Players</span>
              </div>
              <div className="text-right">
                <span className="font-black text-emerald-400 text-xs block">
                  ₹{domesticVsOverseas.domesticSpendCr.toFixed(2)} Cr
                </span>
                <span className="text-[9px] text-zinc-500">
                  {totalSpent > 0
                    ? Math.round((domesticVsOverseas.domesticSpendCr / totalSpent) * 100)
                    : 0}% Spend
                </span>
              </div>
            </div>

            {/* Overseas */}
            <div className="bg-[#0D1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-indigo-300 uppercase block font-bold">OVERSEAS (INTL)</span>
                <span className="text-xs text-white font-bold">{domesticVsOverseas.overseasCount} Players</span>
              </div>
              <div className="text-right">
                <span className="font-black text-indigo-300 text-xs block">
                  ₹{domesticVsOverseas.overseasSpendCr.toFixed(2)} Cr
                </span>
                <span className="text-[9px] text-zinc-500">
                  {totalSpent > 0
                    ? Math.round((domesticVsOverseas.overseasSpendCr / totalSpent) * 100)
                    : 0}% Spend
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
