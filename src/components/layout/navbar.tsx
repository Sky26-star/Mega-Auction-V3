'use client';

// src/components/layout/navbar.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentProfile, signOutUser } from '@/lib/auth';
import type { Profile } from '@/lib/types/auth';
import { Gavel, LogOut, LayoutDashboard, LogIn, UserPlus, Users } from 'lucide-react';

export function Navbar() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.id as string | undefined;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const p = await getCurrentProfile();
        setProfile(p);
      } catch {
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setProfile(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <nav className="w-full bg-[#0B0F0D]/95 border-b border-[#2A312D] backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2.5 text-[#F3F4F1] font-bold text-lg tracking-tight hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-[#181E1A] border border-[#C9A227]/40 flex items-center justify-center text-[#E4B93F]">
            <Gavel className="w-5 h-5" />
          </div>
          <span className="font-display font-extrabold tracking-wider uppercase text-base sm:text-lg text-[#F3F4F1]">
            MEGA AUCTION <span className="text-[#C9A227]">ARENA</span>
          </span>
        </Link>

        {/* Right Nav Items */}
        <div className="flex items-center space-x-4 overflow-x-auto max-w-[60vw] scrollbar-hide">
          {isLoading ? (
            <div className="w-24 h-8 bg-[#141917] rounded-lg animate-pulse border border-[#2A312D] shrink-0" />
          ) : profile ? (
            <div className="flex items-center space-x-3">
              {roomId && (
                <>
                  <Link
                    href={`/rooms/${roomId}/squad`}
                    className="flex items-center space-x-1.5 text-xs font-bold text-[#F3F4F1] hover:text-[#E4B93F] px-3 py-2 rounded-lg hover:bg-[#181E1A] border border-transparent hover:border-[#2A312D] transition-all uppercase tracking-wider"
                  >
                    <Users className="w-4 h-4 text-[#C9A227]" />
                    <span>Squad</span>
                  </Link>
                  <Link
                    href={`/rooms/${roomId}/stats`}
                    className="flex items-center space-x-1.5 text-xs font-bold text-[#F3F4F1] hover:text-[#E4B93F] px-3 py-2 rounded-lg hover:bg-[#181E1A] border border-transparent hover:border-[#2A312D] transition-all uppercase tracking-wider"
                  >
                    <svg className="w-4 h-4 text-[#C9A227]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                    <span>Stats</span>
                  </Link>
                </>
              )}

              <Link
                href="/dashboard"
                className="flex items-center space-x-1.5 text-xs font-bold text-[#F3F4F1] hover:text-[#E4B93F] px-3 py-2 rounded-lg hover:bg-[#181E1A] border border-transparent hover:border-[#2A312D] transition-all uppercase tracking-wider"
              >
                <LayoutDashboard className="w-4 h-4 text-[#C9A227]" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/profile"
                className="flex items-center space-x-2 text-xs font-bold text-[#F3F4F1] hover:text-[#E4B93F] px-3 py-2 rounded-lg hover:bg-[#181E1A] transition-all border border-[#2A312D]"
              >
                <div className="w-6 h-6 rounded-full bg-[#181E1A] border border-[#C9A227]/50 flex items-center justify-center text-[#E4B93F] text-[10px] font-extrabold font-mono-numbers">
                  {profile.display_name?.charAt(0).toUpperCase() || profile.username.charAt(0).toUpperCase()}
                </div>
                <span>{profile.display_name || profile.username}</span>
              </Link>

              <button
                id="navbar-signout-btn"
                onClick={handleSignOut}
                className="flex items-center space-x-1.5 text-xs font-bold text-[#9CA6A0] hover:text-[#B8322E] px-3 py-2 rounded-lg hover:bg-[#B8322E]/10 transition-all uppercase tracking-wider"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                href="/login"
                className="flex items-center space-x-1.5 text-xs font-bold text-[#F3F4F1] hover:text-[#E4B93F] px-3.5 py-2 rounded-lg hover:bg-[#181E1A] transition-all uppercase tracking-wider"
              >
                <LogIn className="w-4 h-4 text-[#C9A227]" />
                <span>Sign In</span>
              </Link>

              <Link
                href="/signup"
                className="flex items-center space-x-1.5 text-xs font-bold text-[#F3F4F1] bg-[#B8322E] hover:bg-[#9B2825] px-4 py-2 rounded-lg shadow-md shadow-[#B8322E]/20 transition-all uppercase tracking-wider"
              >
                <UserPlus className="w-4 h-4" />
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
