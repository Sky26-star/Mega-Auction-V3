'use client';

// src/app/(dashboard)/rooms/[id]/page.tsx
// Phase 5B Room Lobby Page with RPC-Only Team Identity Editing & Participant Removal

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';
import { ParticipantList } from '@/components/rooms/participant-list';
import { TeamList } from '@/components/rooms/team-list';
import { TeamModal } from '@/components/rooms/team-modal';
import {
  getRoomById,
  getRoomParticipants,
  getAuctionTeams,
  updateMyTeam,
  removeRoomParticipant,
} from '@/lib/rooms';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import type { Room, RoomParticipant, Team, UpdateTeamInput } from '@/lib/types/room';
import type { Profile } from '@/lib/types/auth';
import {
  ArrowLeft,
  Crown,
  Database,
  Users,
  Shield,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function RoomLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'PARTICIPANTS' | 'TEAMS'>('TEAMS');

  // Team Modal state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const loadLobbyData = useCallback(async (showSpinner = true) => {
    if (!roomId) return;
    if (showSpinner) setIsLoading(true);
    setError(null);
    try {
      const [prof, roomData] = await Promise.all([
        getCurrentProfile(),
        getRoomById(roomId),
      ]);

      if (!roomData) {
        setError('Room not found or access denied');
        return;
      }

      setProfile(prof);
      setRoom(roomData);

      const parts = await getRoomParticipants(roomId);
      setParticipants(parts);

      if (roomData.auction_id) {
        const teamData = await getAuctionTeams(roomData.auction_id);
        setTeams(teamData);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load room lobby');
      }
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadLobbyData(true);
  }, [loadLobbyData]);

  // Supabase Realtime channel listener for room_participants and teams
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`room_lobby:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => {
          loadLobbyData(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        () => {
          loadLobbyData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, loadLobbyData]);

  const isHost = Boolean(profile && room && room.host_id === profile.id);

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleUpdateMyTeam = async (data: UpdateTeamInput) => {
    if (!editingTeam) return;
    try {
      await updateMyTeam(editingTeam.id, data);
      setIsTeamModalOpen(false);
      setEditingTeam(null);
      await loadLobbyData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update team identity');
    }
  };

  const handleRemoveParticipant = async (participant: RoomParticipant) => {
    const isSelf = Boolean(profile && participant.user_id === profile.id);
    const message = isSelf
      ? 'Are you sure you want to leave this room? Your team franchise will be deleted.'
      : `Are you sure you want to remove participant "${participant.profile?.display_name || 'User'}" from this room?`;

    if (!confirm(message)) return;

    try {
      await removeRoomParticipant(participant.id);
      if (isSelf) {
        router.push('/rooms');
      } else {
        await loadLobbyData();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove participant');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/rooms"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Rooms</span>
          </Link>

          <button
            onClick={() => loadLobbyData(true)}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Lobby</span>
          </button>
        </div>

        {/* Loading / Error state */}
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading auction lobby...</p>
          </div>
        ) : error || !room ? (
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error || 'Room not found'}</span>
          </div>
        ) : (
          <>
            {/* Room Header Banner */}
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-extrabold text-white">{room.name}</h1>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      room.status === 'OPEN'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {room.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400" />
                    Host: <strong className="text-white">{room.host_profile?.display_name || 'Host'}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Pool: <strong className="text-white">{room.player_set_name}</strong>
                  </span>
                  <span>•</span>
                  <span>Purse: <strong className="text-white font-mono">{room.settings?.default_purse} Lakhs</strong></span>
                </div>
              </div>

              {/* Room Code Quick Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Room Join Code
                  </span>
                  <code className="text-2xl font-mono font-extrabold tracking-widest text-indigo-400">
                    {room.code}
                  </code>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
                  title="Copy Room Code"
                >
                  {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('TEAMS')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                  activeTab === 'TEAMS'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Auction Franchises ({teams.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('PARTICIPANTS')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                  activeTab === 'PARTICIPANTS'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Room Roster ({participants.length})</span>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'TEAMS' ? (
              <TeamList
                teams={teams}
                participants={participants}
                currentUserId={profile?.id}
                isHost={isHost}
                onEditMyTeam={(t) => {
                  setEditingTeam(t);
                  setIsTeamModalOpen(true);
                }}
                onRemoveParticipant={handleRemoveParticipant}
              />
            ) : (
              <ParticipantList
                participants={participants}
                teams={teams}
                currentUserId={profile?.id}
                isHost={isHost}
                onRemoveParticipant={handleRemoveParticipant}
              />
            )}
          </>
        )}
      </main>

      {/* Identity Edit Modal */}
      <TeamModal
        isOpen={isTeamModalOpen}
        onClose={() => {
          setIsTeamModalOpen(false);
          setEditingTeam(null);
        }}
        onSubmit={handleUpdateMyTeam}
        initialData={editingTeam}
      />
    </div>
  );
}

