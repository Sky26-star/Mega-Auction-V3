'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useV3AuctionContext } from '@/components/rooms/v3/V3AuctionStateProvider';
import { getCurrentProfile } from '@/lib/auth';
import { V3PlayerCard } from '@/components/rooms/v3/V3PlayerCard';
import { V3BidPanel } from '@/components/rooms/v3/V3BidPanel';
import { V3ResultAnimation } from '@/components/rooms/v3/V3ResultAnimation';
import { V3Timer } from '@/components/rooms/v3/V3Timer';
import { V3Teams } from '@/components/rooms/v3/V3Teams';
import { Navbar } from '@/components/layout/navbar';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { V3Team } from '@/lib/v3-auction-types';

function ResumingCountdown({ targetMs }: { targetMs: number }) {
  const [timeLeft, setTimeLeft] = useState<number>(3);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((targetMs - now) / 1000));
      setTimeLeft(diff);
    };
    update();
    const interval = setInterval(update, 50); // fast update for UI responsiveness
    return () => clearInterval(interval);
  }, [targetMs]);

  const getSubtext = (t: number) => {
    if (t === 3) return 'PREPARE TO BID';
    if (t === 2) return 'GET READY';
    if (t === 1) return 'FINAL CHECK';
    return 'AUCTION LIVE';
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
      <h3 className="text-[#C9A227] font-mono text-xl tracking-[0.2em] uppercase font-bold drop-shadow-md">Auction Resuming</h3>
      <div className="relative flex items-center justify-center w-48 h-48">
        <div className="absolute inset-0 rounded-full border-4 border-[#C9A227]/20 animate-pulse"></div>
        <div className="absolute inset-0 rounded-full border-t-4 border-[#C9A227] animate-spin" style={{ animationDuration: '3s' }}></div>
        <div className="text-8xl font-mono-numbers font-black text-[#F3F4F1] drop-shadow-[0_0_15px_rgba(201,162,39,0.5)]">
          {timeLeft > 0 ? timeLeft : '0'}
        </div>
      </div>
      <p className="text-[#9CA6A0] font-mono text-lg tracking-widest uppercase transition-all duration-300 drop-shadow-sm font-semibold">
        {getSubtext(timeLeft)}
      </p>
    </div>
  );
}

export default function V3AuctionPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const { state, loading, error, refresh, animation, triggerAnimation } = useV3AuctionContext();
  const [myTeam, setMyTeam] = useState<V3Team | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const profile = await getCurrentProfile();
      if (profile) {
        import('@/lib/rooms').then(({ getRoomParticipants, getRoomById }) => {
          getRoomById(roomId).then(room => {
            if (room) {
              setIsHost(room.host_id === profile.id);
            }
          });
          if (state.teams.length > 0) {
            getRoomParticipants(roomId).then(parts => {
              const myPart = parts.find(p => p.user_id === profile.id);
              if (myPart && myPart.team_id) {
                const team = state.teams.find(t => t.id === myPart.team_id);
                setMyTeam(team || null);
              }
            });
          }
        }).catch(err => console.error("Error loading participants/room:", err));
      }
    }
    if (!loading) {
      loadUser();
    }
  }, [roomId, state.teams, loading]);


  const handlePauseAuction = async () => {
    if (!isHost || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/auction/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId: state.auction?.id })
      });
      if (!res.ok) throw new Error('Failed to pause auction');
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeAuction = async () => {
    if (!isHost || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/auction/resume-countdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId: state.auction?.id })
      });
      if (!res.ok) throw new Error('Failed to resume auction');
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (animation) {
      console.log(`[ TRACE 3 ] ${Date.now()} | page.tsx received animation | lot_id: ${animation.lot.id}`);
    }
  }, [animation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F0D] flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#C9A227]" />
        <p className="text-sm font-mono-numbers text-[#9CA6A0] uppercase tracking-widest">
          SYNCING V3 AUCTION STATE...
        </p>
      </div>
    );
  }

  if (error || !state.auction) {
    return (
      <div className="min-h-screen bg-[#0B0F0D] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#B8322E]/10 border-2 border-[#B8322E]/40 p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-[#B8322E]" />
          <div>
            <h2 className="text-xl font-bold text-[#F3F4F1] mb-2 uppercase">Auction Error</h2>
            <p className="text-[#B8322E] font-mono text-sm">{error || 'Auction not found'}</p>
          </div>
          <button
            onClick={() => router.push(`/rooms/${roomId}`)}
            className="px-6 py-2 bg-[#141917] border border-[#2A312D] text-[#F3F4F1] rounded-xl hover:bg-[#1E2522] transition-colors"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Not started yet?
  if (state.auction.status === 'LOBBY' || state.auction.status === 'READY' || state.auction.status === 'STARTING') {
    return (
      <div className="min-h-screen bg-[#0B0F0D] flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-[#9CA6A0] font-mono uppercase tracking-widest mb-4">Waiting for auction to start...</p>
          <button
            onClick={() => router.push(`/rooms/${roomId}`)}
            className="flex items-center space-x-2 text-xs font-mono text-[#F3F4F1] bg-[#141917] border border-[#2A312D] px-4 py-2 rounded-lg hover:bg-[#1E2522]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO LOBBY</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F0D] flex flex-col text-[#F3F4F1] selection:bg-[#C9A227]/30">
      {animation && (
        (() => {
          console.log(`[ TRACE 4 ] ${Date.now()} | Immediately before rendering V3ResultAnimation | lot_id: ${animation.lot.id}`);
          return <V3ResultAnimation animation={animation} teams={state.teams} />;
        })()
      )}

      <Navbar />

      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Navigation & Host Controls */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="group flex items-center space-x-2 text-xs font-mono text-[#9CA6A0] hover:text-[#C9A227] transition-colors bg-[#141917]/50 px-3 py-1.5 rounded-lg border border-transparent hover:border-[#2A312D]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>BACK TO DASHBOARD</span>
          </button>

          {isHost && (
            <div className="flex items-center space-x-2">
              {state.auction.status === 'IN_PROGRESS' && (
                <button
                  onClick={handlePauseAuction}
                  disabled={actionLoading}
                  className="group relative px-5 py-2 overflow-hidden rounded-xl bg-[#141917] border border-[#B8322E]/30 transition-all duration-300 hover:border-[#B8322E] hover:shadow-[0_0_15px_rgba(184,50,46,0.2)] disabled:opacity-50"
                >
                  <div className="absolute inset-0 w-0 bg-[#B8322E]/10 transition-all duration-300 ease-out group-hover:w-full"></div>
                  <div className="relative flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-[#B8322E] group-hover:animate-pulse"></div>
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#F3F4F1]">
                      {actionLoading ? 'PAUSING...' : 'PAUSE AUCTION'}
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* PAUSED OVERLAY */}
        {state.auction.status === 'PAUSED' && (
          <div className="fixed inset-0 z-50 bg-[#0B0F0D]/70 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-500">
            <div className="bg-[#141917] border border-[#C9A227]/30 rounded-3xl p-8 max-w-lg w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center">

              {(() => {
                let resumeTime: number | null = null;
                try {
                  const parsed = state.auction.paused_reason ? JSON.parse(state.auction.paused_reason) : null;
                  resumeTime = parsed?.resume_expires_at || null;
                } catch(e) {}

                if (resumeTime) {
                  return (
                    <div className="w-full">
                      <ResumingCountdown targetMs={resumeTime} />
                    </div>
                  );
                }

                return (
                  <>
                    <div className="w-16 h-16 rounded-full bg-[#C9A227]/10 flex items-center justify-center mb-6">
                      <div className="w-6 h-6 border-l-4 border-r-4 border-[#C9A227] animate-pulse"></div>
                    </div>
                    <h2 className="text-3xl font-bold font-mono text-[#F3F4F1] uppercase tracking-widest mb-2 drop-shadow-md">
                      Auction Paused
                    </h2>

                    <div className="w-full flex flex-col items-center mt-4">
                      {isHost ? (
                        <>
                          <p className="text-[#9CA6A0] font-mono mb-8 leading-relaxed text-sm">
                            The auction is temporarily paused.<br/>
                            Your current auction state has been preserved.
                          </p>
                          <button
                            onClick={handleResumeAuction}
                            disabled={actionLoading}
                            className="group relative w-full py-4 rounded-xl bg-gradient-to-b from-[#C9A227] to-[#B38D1C] text-[#0B0F0D] font-mono font-black text-xl uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(201,162,39,0.2)] hover:shadow-[0_0_40px_rgba(201,162,39,0.4)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-500 ease-in-out"></div>
                            {actionLoading ? 'RESUMING...' : '▶ RESUME AUCTION'}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-[#9CA6A0] font-mono mb-6 leading-relaxed text-sm">
                            The host has temporarily paused the auction.<br/>
                            Please wait for the host to resume.
                          </p>
                          <div className="px-4 py-2 border border-[#2A312D] rounded-lg bg-[#0B0F0D]/50 text-[#8B938E] text-xs font-mono uppercase tracking-widest">
                            STATUS: Auction Paused
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* TOP: Timer and Player Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            {state.currentPlayer && state.currentLot ? (
              <V3PlayerCard player={state.currentPlayer} />
            ) : (
              <div className="h-full min-h-[200px] border-2 border-dashed border-[#2A312D] rounded-3xl bg-[#141917]/50 flex items-center justify-center">
                <span className="font-mono text-[#8B938E] uppercase tracking-widest">Waiting for next player...</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col justify-center">
            {state.currentLot && <V3Timer lot={state.currentLot} auction={state.auction} />}
          </div>
        </div>

        {/* MIDDLE: Bid Panel */}
        <div className="w-full">
          {state.currentLot ? (
            <V3BidPanel
              lot={state.currentLot}
              teams={state.teams}
              myTeam={myTeam}
              auctionId={state.auction.id}
              onBidSuccess={refresh}
            />
          ) : (
            <div className="w-full py-12 border-2 border-dashed border-[#2A312D] rounded-3xl bg-[#141917]/50 flex items-center justify-center">
              <span className="font-mono text-[#8B938E] uppercase tracking-widest">No active lot.</span>
            </div>
          )}
        </div>

        {/* BOTTOM: Teams overview */}
        <div className="w-full pb-12">
          <V3Teams teams={state.teams} lot={state.currentLot} />
        </div>

      </main>
    </div>
  );
}
