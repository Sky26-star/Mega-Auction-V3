'use client';

// src/components/auth/login-form.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInUser } from '@/lib/auth';
import { loginSchema } from '@/lib/validations/auth';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('mega_auction_remember_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const formatted = validation.error.format();
      setFieldErrors({
        email: formatted.email?._errors[0],
        password: formatted.password?._errors[0],
      });
      return;
    }

    setIsLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('mega_auction_remember_email', email.trim());
      } else {
        localStorage.removeItem('mega_auction_remember_email');
      }
      await signInUser({ email, password });
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to sign in. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg p-8 sm:p-10 rounded-2xl bg-[#141917] border-2 border-[#2A312D] shadow-2xl shadow-black/90 backdrop-blur-xl transition-all relative z-10 my-auto">
      
      {/* Segmented Control Navigation Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 mb-8 rounded-xl bg-[#0B0F0D] border border-[#2A312D]">
        <button
          type="button"
          aria-current="page"
          className="py-3 px-4 text-xs sm:text-sm font-bold rounded-lg transition-all bg-[#181E1A] text-[#E4B93F] border border-[#C9A227]/50 text-center uppercase tracking-wider shadow-inner"
        >
          Sign In
        </button>
        <Link
          href="/signup"
          className="py-3 px-4 text-xs sm:text-sm font-semibold rounded-lg text-[#9CA6A0] hover:text-[#F3F4F1] transition-colors text-center uppercase tracking-wider flex items-center justify-center"
        >
          Create Account
        </Link>
      </div>

      {/* Header */}
      <div className="mb-7 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#F3F4F1] mb-2 uppercase font-display">
          WELCOME BACK
        </h1>
        <p className="text-xs sm:text-sm text-[#9CA6A0] leading-relaxed">
          Sign in to continue your cricket auction journey.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-[#8F2724]/20 border border-[#B8322E]/60 flex items-start space-x-3 text-[#F3F4F1] text-xs sm:text-sm shadow-inner"
        >
          <AlertCircle className="w-5 h-5 text-[#B8322E] flex-shrink-0 mt-0.5" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
        {/* Email Field */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-bold text-[#B4BDB7] uppercase tracking-wider mb-2"
          >
            EMAIL / USERNAME
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E8982] pointer-events-none" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              className={`w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#0B0F0D] border text-[#F3F4F1] placeholder-[#9CA6A0] focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition-all disabled:opacity-50 text-sm ${
                fieldErrors.email ? 'border-[#B8322E] bg-[#8F2724]/10' : 'border-[#2A312D]'
              }`}
            />
          </div>
          {fieldErrors.email && (
            <p id="login-email-error" className="mt-1.5 text-xs text-[#B8322E] font-semibold flex items-center gap-1">
              <span>{fieldErrors.email}</span>
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="login-password"
              className="block text-xs font-bold text-[#B4BDB7] uppercase tracking-wider"
            >
              PASSWORD
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#C9A227] hover:text-[#E4B93F] font-semibold transition-colors focus:outline-none focus:underline uppercase tracking-wide text-[11px]"
            >
              FORGOT PASSWORD?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E8982] pointer-events-none" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              className={`w-full pl-10 pr-11 py-3.5 rounded-xl bg-[#0B0F0D] border text-[#F3F4F1] placeholder-[#9CA6A0] focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition-all disabled:opacity-50 text-sm ${
                fieldErrors.password ? 'border-[#B8322E] bg-[#8F2724]/10' : 'border-[#2A312D]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7E8982] hover:text-[#F3F4F1] focus:outline-none p-1.5 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-[#B4BDB7]" />
              ) : (
                <Eye className="w-4 h-4 text-[#B4BDB7]" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="login-password-error" className="mt-1.5 text-xs text-[#B8322E] font-semibold flex items-center gap-1">
              <span>{fieldErrors.password}</span>
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label htmlFor="login-remember" className="flex items-center space-x-2.5 cursor-pointer group">
            <input
              id="login-remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 rounded border-[#2A312D] bg-[#0B0F0D] text-[#B8322E] focus:ring-[#C9A227] focus:ring-offset-[#141917] cursor-pointer accent-[#B8322E]"
            />
            <span className="text-xs text-[#B4BDB7] group-hover:text-[#F3F4F1] transition-colors font-semibold">
              Remember Me
            </span>
          </label>
        </div>

        {/* Primary CTA Button (Auction Crimson #B8322E) */}
        <button
          id="login-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full py-4 px-5 rounded-xl bg-[#B8322E] hover:bg-[#9B2825] active:bg-[#8F2724] text-[#F3F4F1] font-bold text-xs uppercase tracking-widest shadow-xl shadow-[#B8322E]/25 border border-[#B8322E]/60 focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:ring-offset-2 focus:ring-offset-[#0B0F0D] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-h-[52px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#F3F4F1]" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 text-[#F3F4F1]" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
