'use client';

// src/app/(dashboard)/rooms/page.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';
import { RoomCard } from '@/components/rooms/room-card';
import { JoinRoomModal } from '@/components/rooms/join-room-modal';
import { getRooms } from '@/lib/rooms';
import { getCurrentProfile } from '@/lib/auth';
import type { Room } from '@/lib/types/room';
import type { Profile } from '@/lib/types/auth';
import { PlusCircle, LogIn, Key, Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function RoomsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [prof, userRooms] = await Promise.all([
          getCurrentProfile(),
          getRooms(),
        ]);
        setProfile(prof);
        setRooms(userRooms);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load rooms');
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-violet-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-extrabold text-white">Auction Rooms Hub</h1>
            </div>
            <p className="text-sm text-slate-400">
              Host your own cricket auction room or join an existing lobby with a 6-character room code.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-all"
            >
              <LogIn className="w-4 h-4 text-violet-400" />
              <span>Join with Code</span>
            </button>

            <Link
              href="/rooms/create"
              className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Room</span>
            </Link>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Rooms Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
            <Key className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h3 className="text-base font-bold text-white mb-1">No Active Rooms Found</h3>
            <p className="text-xs text-slate-400 mb-6">
              You have not created or joined any auction rooms yet.
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Join Room Code
              </button>
              <Link
                href="/rooms/create"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                Create First Room
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} currentUserId={profile?.id} />
            ))}
          </div>
        )}
      </main>

      {/* Join Modal */}
      <JoinRoomModal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
    </div>
  );
}
