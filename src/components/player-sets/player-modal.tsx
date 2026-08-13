'use client';

// src/components/player-sets/player-modal.tsx
import React, { useState, useEffect } from 'react';
import type { Player, PlayerFormInput, PlayerRole, PlayerCategory } from '@/lib/types/player-set';
import { playerSchema, PLAYER_ROLES, PLAYER_CATEGORIES } from '@/lib/validations/player-set';
import { X, User, Loader2, AlertCircle } from 'lucide-react';

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlayerFormInput) => Promise<void>;
  initialData?: Player | null;
}

export function PlayerModal({ isOpen, onClose, onSubmit, initialData }: PlayerModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<PlayerRole>('BATSMAN');
  const [category, setCategory] = useState<PlayerCategory>('C');
  const [basePrice, setBasePrice] = useState<number>(10);
  const [isOverseas, setIsOverseas] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setRole(initialData.role || 'BATSMAN');
      setCategory(initialData.category || 'C');
      setBasePrice(initialData.base_price || 10);
      setIsOverseas(initialData.is_overseas || false);
      setImageUrl(initialData.image_url || '');
    } else {
      setName('');
      setRole('BATSMAN');
      setCategory('C');
      setBasePrice(10);
      setIsOverseas(false);
      setImageUrl('');
    }
    setError(null);
    setFieldErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const validation = playerSchema.safeParse({
      name,
      role,
      category,
      base_price: Number(basePrice),
      is_overseas: isOverseas,
      image_url: imageUrl || null,
    });

    if (!validation.success) {
      const formatted = validation.error.format();
      setFieldErrors({
        name: formatted.name?._errors[0] || '',
        role: formatted.role?._errors[0] || '',
        category: formatted.category?._errors[0] || '',
        base_price: formatted.base_price?._errors[0] || '',
        image_url: formatted.image_url?._errors[0] || '',
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        name,
        role,
        category,
        base_price: Number(basePrice),
        is_overseas: isOverseas,
        image_url: imageUrl || null,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save player');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {initialData ? 'Edit Player' : 'Add New Player'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="player-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Player Name *
            </label>
            <input
              id="player-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jasprit Bumrah"
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="player-role" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Role *
              </label>
              <select
                id="player-role"
                value={role}
                onChange={(e) => setRole(e.target.value as PlayerRole)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all"
              >
                {PLAYER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="player-category" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                id="player-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as PlayerCategory)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all"
              >
                {PLAYER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    Category {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="player-baseprice" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Base Price (Lakhs/Credits) *
              </label>
              <input
                id="player-baseprice"
                type="number"
                min={1}
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all"
              />
              {fieldErrors.base_price && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.base_price}</p>
              )}
            </div>

            <div className="flex flex-col justify-end">
              <label className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between cursor-pointer h-[42px]">
                <span className="text-xs font-semibold text-slate-300">Overseas Player</span>
                <input
                  type="checkbox"
                  checked={isOverseas}
                  onChange={(e) => setIsOverseas(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="player-imageurl" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Image URL (Optional)
            </label>
            <input
              id="player-imageurl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/player.jpg"
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all"
            />
            {fieldErrors.image_url && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.image_url}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{initialData ? 'Update Player' : 'Add Player'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
