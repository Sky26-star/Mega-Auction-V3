'use client';

// src/components/player-sets/player-table.tsx
import React, { useState, useMemo } from 'react';
import type { Player, PlayerRole, PlayerCategory } from '@/lib/types/player-set';
import { Search, Filter, ArrowUpDown, Globe, Edit, Trash2, UserCheck, Image as ImageIcon } from 'lucide-react';

interface PlayerTableProps {
  players: Player[];
  isOwner: boolean;
  onEditPlayer?: (player: Player) => void;
  onDeletePlayer?: (player: Player) => void;
}

export function PlayerTable({ players, isOwner, onEditPlayer, onDeletePlayer }: PlayerTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [overseasFilter, setOverseasFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'>('price_desc');

  const filteredPlayers = useMemo(() => {
    return players
      .filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
        const matchesRole = roleFilter === 'ALL' || p.role === roleFilter;
        const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
        const matchesOverseas =
          overseasFilter === 'ALL' ||
          (overseasFilter === 'OVERSEAS' && p.is_overseas) ||
          (overseasFilter === 'DOMESTIC' && !p.is_overseas);

        return matchesSearch && matchesRole && matchesCategory && matchesOverseas;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'price_asc') return a.base_price - b.base_price;
        if (sortBy === 'price_desc') return b.base_price - a.base_price;
        return 0;
      });
  }, [players, searchTerm, roleFilter, categoryFilter, overseasFilter, sortBy]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search players by name..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs transition-all"
          />
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Role Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-800/60 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Roles</option>
              <option value="BATSMAN" className="bg-slate-900">Batsman</option>
              <option value="BOWLER" className="bg-slate-900">Bowler</option>
              <option value="ALL_ROUNDER" className="bg-slate-900">All Rounder</option>
              <option value="WICKET_KEEPER" className="bg-slate-900">Wicket Keeper</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-800/60 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              <option value="MARQUEE" className="bg-slate-900">Marquee</option>
              <option value="A" className="bg-slate-900">Cat A</option>
              <option value="B" className="bg-slate-900">Cat B</option>
              <option value="C" className="bg-slate-900">Cat C</option>
              <option value="D" className="bg-slate-900">Cat D</option>
            </select>
          </div>

          {/* Overseas Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-800/60 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <select
              value={overseasFilter}
              onChange={(e) => setOverseasFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Players</option>
              <option value="DOMESTIC" className="bg-slate-900">Domestic</option>
              <option value="OVERSEAS" className="bg-slate-900">Overseas</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-1.5 bg-slate-800/60 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="price_desc" className="bg-slate-900">Price: High to Low</option>
              <option value="price_asc" className="bg-slate-900">Price: Low to High</option>
              <option value="name_asc" className="bg-slate-900">Name: A to Z</option>
              <option value="name_desc" className="bg-slate-900">Name: Z to A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        {filteredPlayers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-semibold">No players found matching current filters.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Base Price</th>
                <th className="px-4 py-3">Origin</th>
                {isOwner && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPlayers.map((player) => (
                <tr key={player.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-semibold text-white flex items-center gap-3">
                    {player.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={player.image_url} alt={player.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <span>{player.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                      {player.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                      player.category === 'MARQUEE'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                    }`}>
                      {player.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-white font-bold">
                    {player.base_price} Lakhs
                  </td>
                  <td className="px-4 py-3">
                    {player.is_overseas ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[11px]">
                        <Globe className="w-3 h-3" /> Overseas
                      </span>
                    ) : (
                      <span className="text-slate-400">Domestic</span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {onEditPlayer && (
                          <button
                            onClick={() => onEditPlayer(player)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit Player"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDeletePlayer && (
                          <button
                            onClick={() => onDeletePlayer(player)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Player"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
