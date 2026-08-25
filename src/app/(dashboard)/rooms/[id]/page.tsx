'use client';

export const dynamic = 'force-dynamic';

// src/app/(dashboard)/rooms/[id]/page.tsx
// Redesigned Live Cricket Auction Control Room Page (V2 Auction State Integrated)

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';
import { AuctionRoomHeader } from '@/components/rooms/auction-room-header';
import { AuctionStatusBar } from '@/components/rooms/auction-status-bar';
import { AuctionInfoStrip } from '@/components/rooms/auction-info-strip';
import { AuctionParticipants } from '@/components/rooms/auction-participants';
import { AuctionHostControls } from '@/components/rooms/auction-host-controls';
import { AuctionInvitePanel } from '@/components/rooms/auction-invite-panel';
import { TeamModal } from '@/components/rooms/team-modal';
import { RoomSettingsModal } from '@/components/rooms/room-settings-modal';

import {
  getRoomById,
  getRoomParticipants,
  getAuctionTeamsByRoomId,
  updateMyTeam,
  removeRoomParticipant,
  updateRoom,
} from '@/lib/rooms';
import { getPlayersBySetId } from '@/lib/player-sets';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import {
  AuctionState,
  RawInputPlayer,
} from '@/lib/auction/state';
import {
  getRoomAuctionState,
  loadAuthoritativeRoomAuctionState,
  subscribeToRoomAuctionState,
} from '@/lib/auction/state-manager';
import type { Room, RoomParticipant, Team, UpdateTeamInput } from '@/lib/types/room';
import type { Profile } from '@/lib/types/auth';
import { Loader2, AlertCircle, Radio, ArrowRight, Trophy } from 'lucide-react';

// Fallback default player pool generator if room player_set_id has 0 players
function getDefaultFallbackPlayers(): RawInputPlayer[] {
  return [
    { id: 'dhoni-01', name: 'MS DHONI', category: 'MARQUEE', base_price: 200, role: 'WICKET_KEEPER', country: 'India', image_url: '/images/ms_dhoni.jpg' },
    { id: 'virat-02', name: 'VIRAT KOHLI', category: 'MARQUEE', base_price: 200, role: 'BATSMAN', country: 'India' },
    { id: 'rohit-03', name: 'ROHIT SHARMA', category: 'MARQUEE', base_price: 200, role: 'BATSMAN', country: 'India' },
    { id: 'bumrah-04', name: 'JASPRIT BUMRAH', category: 'MARQUEE', base_price: 200, role: 'BOWLER', country: 'India' },
    { id: 'cummins-05', name: 'PAT CUMMINS', category: 'A', base_price: 150, role: 'ALL_ROUNDER', country: 'Australia' },
    { id: 'head-06', name: 'TRAVIS HEAD', category: 'A', base_price: 150, role: 'BATSMAN', country: 'Australia' },
    { id: 'klassn-07', name: 'HEINRICH KLASEN', category: 'B', base_price: 100, role: 'WICKET_KEEPER', country: 'South Africa' },
    { id: 'rinku-08', name: 'RINKU SINGH', category: 'C', base_price: 75, role: 'BATSMAN', country: 'India' },
    { id: 'abhishek-09', name: 'ABHISHEK SHARMA', category: 'D', base_price: 50, role: 'ALL_ROUNDER', country: 'India' },
  ];
}

export default function RoomLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Authoritative Auction State
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [isStartingAuction, setIsStartingAuction] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Host and Countdown Overlay States & Refs
  const isHost = Boolean(profile && room && room.host_id === profile.id);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHostRef = useRef(isHost);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const myTeam = useMemo(() => {
    return teams.find((t) => {
      const p = participants.find((part) => part.team_id === t.id);
      return Boolean(profile && p?.user_id === profile.id);
    });
  }, [teams, participants, profile]);

  // Track initial state to handle one-time event-driven navigation for active participants
  const hasEverBeenNotStartedRef = useRef<boolean>(false);

  // Team Modal state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Settings Modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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

        if (roomData.status === 'EXPIRED') {
          setError('Room expired due to inactivity.');
          setIsLoading(false);
          return;
        }

        if (roomData.status === 'LOCKED') {
          console.log('[AUCTION SYNC DEBUG] Lobby loaded for LOCKED room', { roomId });
          return;
        }

        const [parts, teamData] = await Promise.all([
          getRoomParticipants(roomId),
          getAuctionTeamsByRoomId(roomId),
        ]);
        setParticipants(parts);
        setTeams(teamData);

        // Fetch authoritative state from database
        const activeState = await loadAuthoritativeRoomAuctionState(roomId);
        if (activeState) {
          setAuctionState(activeState);
          console.log('[AUCTION SYNC DEBUG] Lobby authoritative state loaded:', {
            roomId,
            auctionId: activeState.auctionId,
            auctionStatus: activeState.auctionStatus,
            currentPlayer: activeState.currentPlayer?.name,
          });
          if (activeState.auctionStatus === 'LIVE') {
            console.log('[AUCTION SYNC DEBUG] Lobby detected LIVE state on load', { roomId });
            // Automatic navigation to old engine has been removed
          }
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
    [roomId, router]
  );

  useEffect(() => {
    loadLobbyData(true);
  }, [loadLobbyData]);

  // Automatic Navigation & State Subscriber
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToRoomAuctionState(roomId, (newState) => {
      setAuctionState(newState);
    });
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (auctionState?.auctionStatus === 'LIVE' || (auctionState as any)?.auctionStatus === 'IN_PROGRESS') {
      console.log('[AUCTION SYNC DEBUG] Lobby detected active state, navigating automatically...', { roomId, status: auctionState?.auctionStatus });
      router.push(`/rooms/${roomId}/auction`);
    }
  }, [auctionState?.auctionStatus, roomId, router]);

  const executeAuctionStart = useCallback(async () => {
    // Old execution logic removed
    setIsStartingAuction(false);
  }, []);

  const cancelLocalCountdownTimer = useCallback(() => {
    console.log('[AUCTION START FLOW] Cancelling countdown overlay.', { roomId });
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setIsCountdownActive(false);
    setCountdownSeconds(3);
  }, [roomId]);

  const startLocalCountdownTimer = useCallback(() => {
    console.log('[AUCTION START FLOW] Starting 3-second countdown overlay...', { roomId });
    setIsCountdownActive(true);
    setCountdownSeconds(3);

    let currentSec = 3;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(async () => {
      currentSec -= 1;
      setCountdownSeconds(currentSec);

      if (currentSec <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setIsCountdownActive(false);
        if (isHostRef.current) {
          // await executeAuctionStart(); -- Removed
        }
      }
    }, 1000);
  }, [roomId]);

  const handleCancelStart = useCallback(() => {
    console.log('[AUCTION START FLOW] Host clicked CANCEL AUCTION START.', { roomId });
    const supabase = createClient();
    supabase.channel(`room:${roomId}`).send({
      type: 'broadcast',
      event: 'auction:countdown_cancel',
      payload: { roomId },
    });
    cancelLocalCountdownTimer();
  }, [roomId, cancelLocalCountdownTimer]);

  const handleStartAuction = useCallback(async () => {
    if (!isHostRef.current) {
      alert('Only the room host can start the auction.');
      return;
    }

    const currentStatus = auctionState?.auctionStatus as string | undefined;
    if (currentStatus === 'IN_PROGRESS' || currentStatus === 'LIVE') {
      console.log('Auction already IN_PROGRESS or LIVE.');
      router.push(`/rooms/${roomId}/auction`);
      return;
    }

    if (auctionState?.auctionStatus === 'COMPLETED') {
      alert('Auction session has already been completed.');
      return;
    }

    console.log('[AUCTION START FLOW] Host clicked START AUCTION.');
    setIsStartingAuction(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('v3_start_auction', {
        p_room_id: roomId
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to start auction');
      }

      // Navigate exactly once after successful RPC
      router.push(`/rooms/${roomId}/auction`);
    } catch (err: any) {
      console.error('Start auction error:', err);
      alert(err.message || 'Failed to start auction');
      setIsStartingAuction(false);
    }
  }, [roomId, auctionState?.auctionStatus, router]);

  const handleContinueAuction = useCallback(() => {
    router.push(`/rooms/${roomId}/auction`);
  }, [roomId, router]);

  // Realtime channel subscription effect
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();
    const channelName = `room:${roomId}`;
    console.log('[AUCTION SYNC DEBUG] Lobby subscribing to Realtime channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          console.log('[AUCTION SYNC DEBUG] Lobby received postgres_changes (auctions):', payload);
          const state = await loadAuthoritativeRoomAuctionState(roomId);
          if (state) setAuctionState(state);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_lots' },
        async (payload) => {
          console.log('[AUCTION SYNC DEBUG] Lobby received postgres_changes (auction_lots):', payload);
          const state = await loadAuthoritativeRoomAuctionState(roomId);
          if (state) setAuctionState(state);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        async (payload) => {
          console.log('[AUCTION SYNC DEBUG] Lobby received postgres_changes (rooms):', payload);
          const state = await loadAuthoritativeRoomAuctionState(roomId);
          if (state) setAuctionState(state);
        }
      )
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
      .on('broadcast', { event: '*' }, async (payload) => {
        console.log('[AUCTION SYNC DEBUG] Lobby received broadcast event:', payload);
        const evt = payload?.event || payload?.payload?.event;
        if (evt === 'auction:countdown_start') {
          console.log('[AUCTION START FLOW] Received broadcast auction:countdown_start');
          startLocalCountdownTimer();
          return;
        }
        if (evt === 'auction:countdown_cancel') {
          console.log('[AUCTION START FLOW] Received broadcast auction:countdown_cancel');
          cancelLocalCountdownTimer();
          return;
        }
      })
      .subscribe((status) => {
        console.log('[AUCTION SYNC DEBUG] Lobby channel subscription status:', channelName, status);
      });

    // 1-second interval lobby status poll to guarantee no client is stranded in lobby when auction starts
    const pollInterval = setInterval(() => {
      loadLobbyData(false);
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [roomId, loadLobbyData, startLocalCountdownTimer, cancelLocalCountdownTimer]);

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

  const handleUpdateSettings = async (data: { name: string; default_purse: number; timer_duration_seconds: number; max_squad_size: number; bot_count?: number }) => {
    try {
      await updateRoom(roomId, data);
      setIsSettingsModalOpen(false);
      await loadLobbyData(false);
    } catch (err: unknown) {
      throw err; // Modal handles displaying the error
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

  const leadingTeamName = useMemo(() => {
    if (!auctionState?.highestBidderId) return 'NO BIDS / NONE';
    const team = teams.find((t) => t.id === auctionState.highestBidderId);
    return team ? team.name : 'NO BIDS / NONE';
  }, [auctionState, teams]);

  const isAuctionLive = auctionState?.auctionStatus === 'LIVE';

  return (
    <div className="min-h-screen bg-[#0B0F0D] text-[#F3F4F1] flex flex-col font-sans selection:bg-[#C9A227]/30 selection:text-[#E4B93F]">
      <Navbar />

      <main className="flex-1 flex flex-col w-full">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#C9A227]" />
            <p className="text-sm font-mono-numbers text-[#9CA6A0] uppercase tracking-widest">
              INITIALIZING AUCTION CONTROL ROOM...
            </p>
          </div>
        ) : error || !room ? (
          <div className="max-w-4xl mx-auto w-full my-12 p-6 rounded-2xl bg-[#B8322E]/10 border-2 border-[#B8322E]/40 text-[#B8322E] text-sm flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <AlertCircle className="w-6 h-6 flex-shrink-0 text-[#B8322E]" />
              <div className="font-mono-numbers">
                <strong className="block text-base font-bold uppercase mb-1">
                  {error?.includes('expired') ? 'ROOM EXPIRED' : 'AUCTION ACCESS ERROR'}
                </strong>
                <span className="text-[#F3F4F1]/90">{error || 'Auction room was not found.'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 pt-2 border-t border-[#B8322E]/20">
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-xl bg-[#141917] hover:bg-[#1E2522] border border-[#2A312D] text-xs font-mono-numbers font-bold text-[#F3F4F1] transition-all"
              >
                RETURN TO DASHBOARD
              </Link>
              <Link
                href="/rooms"
                className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] border border-[#7C3AED]/50 text-xs font-mono-numbers font-bold text-white shadow-md transition-all"
              >
                BROWSE ROOMS
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col w-full space-y-0">


            {/* Old Live Auction Navigation Banner has been removed per V3 Engine prep */}

            {/* PROMINENT COMPLETED AUCTION SUMMARY BANNER (Rendered when auction is COMPLETED) */}
            {auctionState?.auctionStatus === 'COMPLETED' && (
              <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 p-3 text-white shadow-xl flex items-center justify-center space-x-4 font-mono font-bold text-xs sm:text-sm border-b border-purple-500/30">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>AUCTION COMPLETED</span>
                </div>
                <span className="hidden sm:inline">|</span>
                <Link
                  href={`/rooms/${roomId}/summary`}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 flex items-center space-x-2 transition-all hover:scale-105 shadow-md"
                >
                  <span>VIEW AUCTION SUMMARY & RESULTS</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </Link>
              </div>
            )}

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
                <div className="lg:col-span-7 flex flex-col h-full items-center justify-center border-2 border-dashed border-[#2A312D] rounded-3xl bg-[#0B0F0D]/50 text-[#8B938E] p-8 text-center">
                  <h2 className="text-xl font-black uppercase font-display tracking-wider mb-2">AUCTION LOBBY</h2>
                  <p className="font-mono text-sm max-w-md">
                    {isHost
                      ? 'You are the Host. When everyone is ready, click "START AUCTION" to enter the live auction room.'
                      : 'Waiting for the Host to start the auction. You will be automatically redirected to the live auction room when it begins.'}
                  </p>
                </div>

                {/* RIGHT CONTROL PANEL COLUMN (~35% width on desktop) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Host Controls */}
                  <AuctionHostControls
                    isHost={isHost}
                    onStartAuction={handleStartAuction}
                    onContinueAuction={handleContinueAuction}
                    onOpenSettings={() => setIsSettingsModalOpen(true)}
                    auctionStatus={auctionState?.auctionStatus || 'NOT_STARTED'}
                    isStartingAuction={isStartingAuction || isCountdownActive}
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

      {/* 3-SECOND STARTING COUNTDOWN OVERLAY (HOST ONLY) */}
      {isCountdownActive && (
        <div className="fixed inset-0 z-50 bg-[#0B0F0D]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-8 rounded-3xl bg-[#141917] border-2 border-[#C9A227]/50 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#C9A227]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2">
              <span className="text-xs font-mono font-extrabold text-[#E4B93F] uppercase tracking-widest block">
                MEGA AUCTION ARENA
              </span>
              <h2 className="text-2xl font-black text-[#F3F4F1] uppercase font-display tracking-tight">
                AUCTION STARTING
              </h2>
            </div>

            {/* Countdown Digit Display */}
            <div className="py-4">
              <div className="w-28 h-28 mx-auto rounded-3xl bg-[#0B0F0D] border-4 border-[#C9A227] flex items-center justify-center font-mono font-black text-6xl text-[#E4B93F] shadow-2xl animate-pulse">
                {countdownSeconds}
              </div>
            </div>

            <p className="text-xs font-mono text-[#9CA6A0] uppercase tracking-wider">
              GET READY... INITIALIZING MULTIPLAYER SYNC
            </p>

            {/* CANCEL BUTTON (HOST ONLY) */}
            {isHost && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCancelStart}
                  className="w-full py-3 px-6 rounded-xl bg-red-950/80 hover:bg-red-900 border-2 border-red-500/60 text-red-300 font-mono font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  CANCEL AUCTION START
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Room Settings Edit Modal */}
      <RoomSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSubmit={handleUpdateSettings}
        initialData={room}
      />
    </div>
  );
}
