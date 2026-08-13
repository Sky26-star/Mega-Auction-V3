'use client';

// src/components/rooms/room-card.tsx
import React, { useState } from 'react';
import Link from 'next/link';
import type { Room } from '@/lib/types/room';
import { Users, Crown, Key, ArrowRight, Database, Copy, Check } from 'lucide-react';

interface RoomCardProps {
  room: Room;
  currentUserId?: string;
}

export function RoomCard({ room, currentUserId }: RoomCardProps) {
  const [copied, setCopied] = useState(false);
  const isHost = currentUserId ? room.host_id === currentUserId : false;

  const handleCopyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all duration-200 group flex flex-col justify-between shadow-xl relative overflow-hidden">
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/10 transition-all pointer-events-none" />

      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                {room.name}
              </h3>
              {isHost && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Crown className="w-3 h-3" /> Host
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>Host:</span>
              <strong className="text-slate-200">{room.host_profile?.display_name || 'Host'}</strong>
            </p>
          </div>

          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              room.status === 'OPEN'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : room.status === 'LOCKED'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {room.status}
          </span>
        </div>

        {/* Details Grid */}
        <div className="my-4 grid grid-cols-2 gap-3 text-xs">
          {/* Room Code Badge */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <code className="font-mono font-bold tracking-widest text-indigo-300">{room.code}</code>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Copy Room Code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Player Set Badge */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2 text-slate-300 truncate">
            <Database className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate font-medium">{room.player_set_name || 'IPL Pool'}</span>
          </div>
        </div>

        {/* Settings Summary */}
        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
          <span className="flex items-center gap-1 font-mono">
            Purse: <strong className="text-white">{room.settings?.default_purse ?? 1000} Lakhs</strong>
          </span>
          <span className="flex items-center gap-1">
            Timer: <strong className="text-white">{room.settings?.timer_duration_seconds ?? 15}s</strong>
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-3 border-t border-slate-800/80">
        <Link
          href={`/rooms/${room.id}`}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all"
        >
          <span>Enter Room Lobby</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
