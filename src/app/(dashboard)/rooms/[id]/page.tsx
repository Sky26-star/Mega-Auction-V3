'use client';

// src/app/(dashboard)/rooms/[id]/page.tsx
// Redesigned Live Cricket Auction Control Room Page
// Preserves 100% backend queries, RPC contracts, realtime listeners, and team/participant logic.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { AuctionRoomHeader } from '@/components/rooms/auction-room-header';
import { AuctionStatusBar } from '@/components/rooms/auction-status-bar';
import { AuctionInfoStrip } from '@/components/rooms/auction-info-strip';
import { AuctionStage } from '@/components/rooms/auction-stage';
import { AuctionParticipants } from '@/components/rooms/auction-participants';
import { AuctionHostControls } from '@/components/rooms/auction-host-controls';
import { AuctionInvitePanel } from '@/components/rooms/auction-invite-panel';
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
import { Loader2, AlertCircle } from 'lucide-react';

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

  // Team Modal state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const loadLobbyData = useCallback(
    async (showSpinner = true) => {
      if (!roomId) return;
      if (showSpinner) setIsLoading(true);
      setError(null);
      try {
        const [prof, roomData] = await Promise.all([
          getCurrentProfile(),
          getRoomById(roomId),
        ]);

        if (!roomData) {
          setError('Auction control room not found or access denied.');
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
          setError('Failed to load auction room lobby.');
        }
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [roomId]
  );

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

  const myTeam = teams.find((t) => {
    const p = participants.find((part) => part.team_id === t.id);
    return Boolean(profile && p?.user_id === profile.id);
  });

  const handleUpdateMyTeam = async (data: UpdateTeamInput) => {
    if (!editingTeam) return;
    try {
      await updateMyTeam(editingTeam.id, data);
      setIsTeamModalOpen(false);
      setEditingTeam(null);
      await loadLobbyData(false);
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
        await loadLobbyData(false);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove participant');
    }
  };

  const handleCopyInviteLink = () => {
    if (!room?.code) return;
    const inviteUrl = `${window.location.origin}/rooms/join?code=${room.code}`;
    navigator.clipboard.writeText(inviteUrl);
  };

  const defaultPurseCr = room?.settings?.default_purse || 100;
  const maxSquadSize = room?.settings?.max_squad_size || 15;
  const maxOverseas = room?.settings?.max_overseas || 8;
  const timerSeconds = room?.settings?.timer_duration_seconds || 15;

  return (
    <div className="min-h-screen bg-[#0B0F0D] text-[#F3F4F1] flex flex-col font-sans selection:bg-[#C9A227]/30 selection:text-[#E4B93F]">
      <Navbar />

      {/* Main Content Viewport Area */}
      <main className="flex-1 flex flex-col w-full">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#C9A227]" />
            <p className="text-sm font-mono-numbers text-[#9CA6A0] uppercase tracking-widest">
              INITIALIZING AUCTION CONTROL ROOM...
            </p>
          </div>
        ) : error || !room ? (
          <div className="max-w-4xl mx-auto w-full my-12 p-6 rounded-2xl bg-[#B8322E]/10 border-2 border-[#B8322E]/40 text-[#B8322E] text-sm flex items-center space-x-4">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div className="font-mono-numbers">
              <strong className="block text-base font-bold uppercase mb-1">AUCTION ACCESS ERROR</strong>
              <span>{error || 'Auction room was not found.'}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col w-full space-y-0">
            {/* Top Room Console Header */}
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
              <AuctionRoomHeader
                room={room}
                participantCount={participants.length}
                maxManagers={10}
                isHost={isHost}
                onRefresh={() => loadLobbyData(true)}
                isLoading={isLoading}
              />
            </div>

            {/* Horizontal Auction Status Ticker Bar */}
            <AuctionStatusBar
              participantCount={participants.length}
              roomCode={room.code}
              defaultPurseCr={defaultPurseCr}
              playerSetName={room.player_set_name}
              isConnected={true}
            />

            {/* Horizontal Auction Info Strip */}
            <AuctionInfoStrip
              playerSetName={room.player_set_name}
              defaultPurseCr={defaultPurseCr}
              timerSeconds={timerSeconds}
              maxSquadSize={maxSquadSize}
              maxOverseas={maxOverseas}
              botCount={room.settings?.bot_count ?? 0}
              totalManagers={participants.length}
              maxManagers={10}
            />

            {/* Main Stage & Control Panel Layout Grid */}
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* LEFT STAGE COLUMN (~65% width on desktop) */}
                <div className="lg:col-span-7 flex flex-col h-full">
                  <AuctionStage
                    roomName={room.name}
                    isHost={isHost}
                  />
                </div>

                {/* RIGHT CONTROL PANEL COLUMN (~35% width on desktop) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Host Controls */}
                  <AuctionHostControls
                    isHost={isHost}
                    onEditTeam={
                      myTeam
                        ? () => {
                            setEditingTeam(myTeam);
                            setIsTeamModalOpen(true);
                          }
                        : undefined
                    }
                    onCopyInvite={handleCopyInviteLink}
                    onLeaveRoom={() => {
                      const myPart = participants.find((p) => profile && p.user_id === profile.id);
                      if (myPart) handleRemoveParticipant(myPart);
                    }}
                  />

                  {/* Invite Panel */}
                  <AuctionInvitePanel roomCode={room.code} />

                  {/* Auction Managers Roster */}
                  <AuctionParticipants
                    teams={teams}
                    participants={participants}
                    currentUserId={profile?.id}
                    isHost={isHost}
                    maxSquadSize={maxSquadSize}
                    maxOverseas={maxOverseas}
                    onEditTeam={(t) => {
                      setEditingTeam(t);
                      setIsTeamModalOpen(true);
                    }}
                    onRemoveParticipant={handleRemoveParticipant}
                  />
                </div>

              </div>
            </div>
          </div>
        )}
      </main>

      {/* Team Identity Edit Modal */}
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
