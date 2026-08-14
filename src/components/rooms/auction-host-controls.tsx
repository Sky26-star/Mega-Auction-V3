'use client';

// src/components/rooms/auction-host-controls.tsx
// Host Controls Component for Live Auction Room

import React from 'react';
import { Settings, Share2, LogOut, Shield } from 'lucide-react';

export interface AuctionHostControlsProps {
  isHost: boolean;
  onEditTeam?: () => void;
  onCopyInvite?: () => void;
  onLeaveRoom?: () => void;
}

export function AuctionHostControls({
  isHost,
  onEditTeam,
  onCopyInvite,
  onLeaveRoom,
}: AuctionHostControlsProps) {
  return (
    <div className="w-full rounded-2xl bg-[#141917] border-2 border-[#2A312D] p-4 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A312D] pb-2.5">
        <h3 className="text-xs font-black text-[#F3F4F1] uppercase font-display tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#E4B93F]" />
          <span>ROOM CONTROLS</span>
        </h3>
        {isHost && (
          <span className="text-[10px] font-mono-numbers font-extrabold text-[#E4B93F] bg-[#0B0F0D] px-2 py-0.5 rounded border border-[#2A312D]">
            HOST CONTROL
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        {onEditTeam && (
          <button
            type="button"
            onClick={onEditTeam}
            className="w-full py-2 px-3 rounded-xl bg-[#0B0F0D] hover:bg-[#181E1A] border border-[#2A312D] text-[#F3F4F1] hover:border-[#C9A227]/40 text-xs font-mono-numbers font-bold flex items-center justify-between transition-all"
          >
            <span>EDIT MY FRANCHISE</span>
            <Settings className="w-3.5 h-3.5 text-[#C9A227]" />
          </button>
        )}

        {onCopyInvite && (
          <button
            type="button"
            onClick={onCopyInvite}
            className="w-full py-2 px-3 rounded-xl bg-[#0B0F0D] hover:bg-[#181E1A] border border-[#2A312D] text-[#F3F4F1] hover:border-[#C9A227]/40 text-xs font-mono-numbers font-bold flex items-center justify-between transition-all"
          >
            <span>SHARE ROOM INVITE</span>
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        )}

        {onLeaveRoom && (
          <button
            type="button"
            onClick={onLeaveRoom}
            className="w-full py-2 px-3 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-400 text-xs font-mono-numbers font-bold flex items-center justify-between transition-all"
          >
            <span>LEAVE ROOM</span>
            <LogOut className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
}
