'use client';

// src/app/(dashboard)/player-sets/page.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { PlayerSetCard } from '@/components/player-sets/player-set-card';
import { PlayerSetModal } from '@/components/player-sets/player-set-modal';
import { getPlayerSets, createPlayerSet, updatePlayerSet, deletePlayerSet } from '@/lib/player-sets';
import { getCurrentProfile } from '@/lib/auth';
import type { PlayerSet, PlayerSetFormInput } from '@/lib/types/player-set';
import type { Profile } from '@/lib/types/auth';
import { Database, PlusCircle, Search, Filter, Loader2, AlertCircle } from 'lucide-react';

export default function PlayerSetsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [playerSets, setPlayerSets] = useState<PlayerSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [tabFilter, setTabFilter] = useState<'ALL' | 'MY_SETS' | 'PUBLIC'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<PlayerSet | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [prof, sets] = await Promise.all([
          getCurrentProfile(),
          getPlayerSets(),
        ]);
        setProfile(prof);
        setPlayerSets(sets);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load player sets');
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateOrUpdateSet = async (data: PlayerSetFormInput) => {
    if (editingSet) {
      const updated = await updatePlayerSet(editingSet.id, data);
      setPlayerSets((prev) => prev.map((s) => (s.id === updated.id ? { ...updated, player_count: s.player_count } : s)));
    } else {
      const newSet = await createPlayerSet(data);
      setPlayerSets((prev) => [{ ...newSet, player_count: 0 }, ...prev]);
    }
  };

  const handleDeleteSet = async (setToDelete: PlayerSet) => {
    if (!confirm(`Are you sure you want to delete "${setToDelete.name}"? All players inside will be permanently deleted.`)) {
      return;
    }
    try {
      await deletePlayerSet(setToDelete.id);
      setPlayerSets((prev) => prev.filter((s) => s.id !== setToDelete.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete player set');
    }
  };

  const filteredSets = useMemo(() => {
    return playerSets.filter((ps) => {
      const matchesSearch = ps.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (ps.description && ps.description.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      
      const isOwner = profile ? ps.created_by === profile.id : false;
      const matchesTab =
        tabFilter === 'ALL' ||
        (tabFilter === 'MY_SETS' && isOwner) ||
        (tabFilter === 'PUBLIC' && ps.is_public);

      return matchesSearch && matchesTab;
    });
  }, [playerSets, searchTerm, tabFilter, profile]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Banner */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-extrabold text-white">Player Sets Management</h1>
            </div>
            <p className="text-sm text-slate-400">
              Create, configure, and manage custom cricket player pools for your live auction rooms.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingSet(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Player Set</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Tab Filters */}
          <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setTabFilter('ALL')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                tabFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Sets ({playerSets.length})
            </button>
            <button
              onClick={() => setTabFilter('MY_SETS')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                tabFilter === 'MY_SETS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              My Sets ({playerSets.filter((s) => profile && s.created_by === profile.id).length})
            </button>
            <button
              onClick={() => setTabFilter('PUBLIC')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                tabFilter === 'PUBLIC' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Public Sets ({playerSets.filter((s) => s.is_public).length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search player sets..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs transition-all"
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filteredSets.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center text-slate-400">
            <Database className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h3 className="text-base font-bold text-white mb-1">No Player Sets Found</h3>
            <p className="text-xs mb-6">Create a new set or adjust your filters to view player pools.</p>
            <button
              onClick={() => {
                setEditingSet(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Set</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredSets.map((set) => {
              const isOwner = profile ? set.created_by === profile.id : false;
              return (
                <PlayerSetCard
                  key={set.id}
                  playerSet={set}
                  isOwner={isOwner}
                  onEdit={(s) => {
                    setEditingSet(s);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDeleteSet}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Modal */}
      <PlayerSetModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSet(null);
        }}
        onSubmit={handleCreateOrUpdateSet}
        initialData={editingSet}
      />
    </div>
  );
}
