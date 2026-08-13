'use client';

// src/components/auth/signup-form.tsx
import React, { useState } from 'react';
import Link from 'next/link';
import { signUpUser } from '@/lib/auth';
import { signupSchema } from '@/lib/validations/auth';
import { Mail, Lock, AtSign, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    // Pass username as displayName internally to satisfy Zod signupSchema contract
    const validation = signupSchema.safeParse({
      email,
      username,
      displayName: username,
      password,
      confirmPassword,
    });

    if (!validation.success) {
      const formatted = validation.error.format();
      setFieldErrors({
        email: formatted.email?._errors[0] || '',
        username: formatted.username?._errors[0] || '',
        password: formatted.password?._errors[0] || '',
        confirmPassword: formatted.confirmPassword?._errors[0] || '',
      });
      return;
    }

    setIsLoading(true);
    try {
      await signUpUser({
        email,
        username,
        displayName: username.trim(),
        password,
        confirmPassword,
      });

      setSuccess('Account created successfully! Please check your email to confirm your account.');
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-7 sm:p-9 rounded-2xl bg-[#141917] border border-[#2A312D] shadow-2xl shadow-black/90 backdrop-blur-xl transition-all relative z-10">
      {/* Segmented Control Navigation Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 mb-6 rounded-xl bg-[#0B0F0D] border border-[#2A312D]">
        <Link
          href="/login"
          className="py-2.5 px-4 text-xs font-semibold rounded-lg text-[#9CA6A0] hover:text-[#F3F4F1] transition-colors text-center uppercase tracking-wider flex items-center justify-center"
        >
          Sign In
        </Link>
        <button
          type="button"
          aria-current="page"
          className="py-2.5 px-4 text-xs font-bold rounded-lg transition-all bg-[#181E1A] text-[#E4B93F] border border-[#C9A227]/40 text-center uppercase tracking-wider"
        >
          Create Account
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#F3F4F1] mb-1.5 uppercase font-display">
          CREATE YOUR AUCTION ACCOUNT
        </h1>
        <p className="text-xs sm:text-sm text-[#9CA6A0] leading-relaxed">
          Join the arena and start building your dream squad.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-[#8F2724]/20 border border-[#B8322E]/60 flex items-start space-x-3 text-[#F3F4F1] text-xs sm:text-sm shadow-inner"
        >
          <AlertCircle className="w-4 h-4 text-[#B8322E] flex-shrink-0 mt-0.5" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div
          role="status"
          className="mb-5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-start space-x-3 text-emerald-300 text-xs sm:text-sm shadow-inner"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span className="leading-snug">{success}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" id="signup-form">
        {/* Email Field */}
        <div>
          <label htmlFor="signup-email" className="block text-xs font-bold text-[#B4BDB7] uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E8982] pointer-events-none" />
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F0D] border text-[#F3F4F1] placeholder-[#9CA6A0] focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition-all disabled:opacity-50 text-xs sm:text-sm ${
                fieldErrors.email ? 'border-[#B8322E] bg-[#8F2724]/10' : 'border-[#2A312D]'
              }`}
            />
          </div>
          {fieldErrors.email && (
            <p id="signup-email-error" className="mt-1 text-xs text-[#B8322E] font-semibold">{fieldErrors.email}</p>
          )}
        </div>

        {/* Username Field */}
        <div>
          <label htmlFor="signup-username" className="block text-xs font-bold text-[#B4BDB7] uppercase tracking-wider mb-1.5">
            Username
          </label>
          <div className="relative">
            <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E8982] pointer-events-none" />
            <input
              id="signup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="player_one"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'signup-username-error' : undefined}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F0D] border text-[#F3F4F1] placeholder-[#9CA6A0] focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition-all disabled:opacity-50 text-xs sm:text-sm ${
                fieldErrors.username ? 'border-[#B8322E] bg-[#8F2724]/10' : 'border-[#2A312D]'
              }`}
            />
          </div>
          {fieldErrors.username && (
            <p id="signup-username-error" className="mt-1 text-xs text-[#B8322E] font-semibold">{fieldErrors.username}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="signup-password" className="block text-xs font-bold text-[#B4BDB7] uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E8982] pointer-events-none" />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
              className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#0B0F0D] border text-[#F3F4F1] placeholder-[#9CA6A0] focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition-all disabled:opacity-50 text-xs sm:text-sm ${
                fieldErrors.password ? 'border-[#B8322E] bg-[#8F2724]/10' : 'border-[#2A312D]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7E8982] hover:text-[#F3F4F1] focus:outline-none p-1 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-[#B4BDB7]" />
              ) : (
                <Eye className="w-4 h-4 text-[#B4BDB7]" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="signup-password-error" className="mt-1 text-xs text-[#B8322E] font-semibold">{fieldErrors.password}</p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label htmlFor="signup-confirmpassword" className="block text-xs font-bold text-[#B4BDB7] uppercase tracking-wider mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E8982] pointer-events-none" />
            <input
              id="signup-confirmpassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? 'signup-confirmpassword-error' : undefined}
              className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#0B0F0D] border text-[#F3F4F1] placeholder-[#9CA6A0] focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition-all disabled:opacity-50 text-xs sm:text-sm ${
                fieldErrors.confirmPassword ? 'border-[#B8322E] bg-[#8F2724]/10' : 'border-[#2A312D]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7E8982] hover:text-[#F3F4F1] focus:outline-none p-1 transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4 text-[#B4BDB7]" />
              ) : (
                <Eye className="w-4 h-4 text-[#B4BDB7]" />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p id="signup-confirmpassword-error" className="mt-1 text-xs text-[#B8322E] font-semibold">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          id="signup-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 mt-2 rounded-xl bg-[#B8322E] hover:bg-[#9B2825] active:bg-[#8F2724] text-[#F3F4F1] font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#B8322E]/20 border border-[#B8322E]/50 focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:ring-offset-2 focus:ring-offset-[#0B0F0D] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-h-[48px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#F3F4F1]" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4 text-[#F3F4F1]" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
