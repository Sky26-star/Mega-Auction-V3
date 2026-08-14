'use client';

// src/app/(dashboard)/player-sets/[id]/page.tsx
// Player Set Detail Page with V2 Player Table, Modals, and PlayerCard Foundation

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { PlayerTable } from '@/components/player-sets/player-table';
import { PlayerModal } from '@/components/player-sets/player-modal';
import { CSVImportModal } from '@/components/player-sets/csv-import-modal';
import { PlayerCard } from '@/components/player-sets/player-card';
import {
  getPlayerSetById,
  getPlayersBySetId,
  createPlayer,
  updatePlayer,
  deletePlayer,
  bulkInsertPlayers,
} from '@/lib/player-sets';
import { getCurrentProfile } from '@/lib/auth';
import type { PlayerSet, Player, PlayerFormInput } from '@/lib/types/player-set';
import type { Profile } from '@/lib/types/auth';
import {
  ArrowLeft,
  Database,
  PlusCircle,
  UploadCloud,
  Globe,
  Lock,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react';
import Link from 'next/link';

export default function PlayerSetDetailPage() {
  const params = useParams();
  const playerSetId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [playerSet, setPlayerSet] = useState<PlayerSet | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [cardPlayer, setCardPlayer] = useState<Player | null>(null);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!playerSetId) return;
      setIsLoading(true);
      setError(null);
      try {
        const [prof, set, plyrs] = await Promise.all([
          getCurrentProfile(),
          getPlayerSetById(playerSetId),
          getPlayersBySetId(playerSetId),
        ]);

        if (!set) {
          setError('Player set not found or access denied');
          return;
        }

        setProfile(prof);
        setPlayerSet(set);
        setPlayers(plyrs);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load player set details');
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [playerSetId]);

  const isOwner = Boolean(profile && playerSet && playerSet.created_by === profile.id);

  const handleCreateOrUpdatePlayer = async (data: PlayerFormInput) => {
    if (editingPlayer) {
      const updated = await updatePlayer(editingPlayer.id, data);
      setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const newPlayer = await createPlayer(playerSetId, data);
      setPlayers((prev) => [newPlayer, ...prev]);
    }
  };

  const handleDeletePlayer = async (playerToDelete: Player) => {
    if (!confirm(`Are you sure you want to delete "${playerToDelete.name}"?`)) {
      return;
    }
    try {
      await deletePlayer(playerToDelete.id);
      setPlayers((prev) => prev.filter((p) => p.id !== playerToDelete.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete player');
    }
  };

  const handleCSVImport = async (validRows: PlayerFormInput[]): Promise<number> => {
    const insertedCount = await bulkInsertPlayers(playerSetId, validRows);
    const updatedPlayers = await getPlayersBySetId(playerSetId);
    setPlayers(updatedPlayers);
    return insertedCount;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Back Link */}
        <div>
          <Link
            href="/player-sets"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Player Sets</span>
          </Link>
        </div>

        {/* Loading / Error State */}
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading player set details...</p>
          </div>
        ) : error || !playerSet ? (
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error || 'Player set not found'}</span>
          </div>
        ) : (
          <>
            {/* Header Details */}
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h1 className="text-2xl font-bold text-white">{playerSet.name}</h1>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          playerSet.is_public
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {playerSet.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {playerSet.is_public ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  {playerSet.description || 'No description provided.'}
                </p>

                <div className="mt-4 flex items-center space-x-4 text-xs text-slate-400 font-medium">
                  <span className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <strong className="text-white">{players.length}</strong> Total Players
                  </span>
                  <span>•</span>
                  <span>Created {new Date(playerSet.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Owner Controls */}
              {isOwner && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setIsCSVModalOpen(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
                  >
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    <span>Import CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingPlayer(null);
                      setIsPlayerModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Player</span>
                  </button>
                </div>
              )}
            </div>

            {/* Players Table */}
            <PlayerTable
              players={players}
              isOwner={isOwner}
              onViewPlayer={(p) => setCardPlayer(p)}
              onEditPlayer={(p) => {
                setEditingPlayer(p);
                setIsPlayerModalOpen(true);
              }}
              onDeletePlayer={handleDeletePlayer}
            />
          </>
        )}
      </main>

      {/* Single Player Modal */}
      <PlayerModal
        isOpen={isPlayerModalOpen}
        onClose={() => {
          setIsPlayerModalOpen(false);
          setEditingPlayer(null);
        }}
        onSubmit={handleCreateOrUpdatePlayer}
        initialData={editingPlayer}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        onImport={handleCSVImport}
      />

      {/* Player Card Preview Modal */}
      {cardPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <PlayerCard player={cardPlayer} onClose={() => setCardPlayer(null)} />
        </div>
      )}
    </div>
  );
}
