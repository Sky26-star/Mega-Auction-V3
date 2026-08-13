'use client';

// src/components/player-sets/player-set-card.tsx
import React from 'react';
import Link from 'next/link';
import type { PlayerSet } from '@/lib/types/player-set';
import { Database, Users, Globe, Lock, ArrowRight, Edit, Trash2 } from 'lucide-react';

interface PlayerSetCardProps {
  playerSet: PlayerSet;
  isOwner: boolean;
  onEdit?: (playerSet: PlayerSet) => void;
  onDelete?: (playerSet: PlayerSet) => void;
}

export function PlayerSetCard({ playerSet, isOwner, onEdit, onDelete }: PlayerSetCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-xl backdrop-blur-md transition-all flex flex-col justify-between group">
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                playerSet.is_public
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {playerSet.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {playerSet.is_public ? 'Public' : 'Private'}
              </span>
            </div>
          </div>

          {/* Action Buttons for Owner */}
          {isOwner && (
            <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  onClick={() => onEdit(playerSet)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Edit Player Set"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(playerSet)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete Player Set"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Name & Description */}
        <h3 className="text-lg font-bold text-white mb-1.5 group-hover:text-indigo-400 transition-colors">
          {playerSet.name}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 mb-6 min-h-[32px] leading-relaxed">
          {playerSet.description || 'No description provided.'}
        </p>
      </div>

      {/* Footer Info & View Button */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center text-slate-400 space-x-1.5 font-medium">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>{playerSet.player_count || 0} Players</span>
        </div>

        <Link
          href={`/player-sets/${playerSet.id}`}
          className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-semibold group/link transition-colors"
        >
          <span>Manage</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
