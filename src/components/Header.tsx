import React from 'react';
import { Shield, Film, ListOrdered, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { QueueJob } from '../types.js';

interface HeaderProps {
  onOpenAdmin: () => void;
  onScrollToQueue: () => void;
  jobs: QueueJob[];
  accessMode: 'public' | 'private';
  isApproved: boolean;
  onRequestAccess: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAdmin,
  onScrollToQueue,
  jobs,
  accessMode,
  isApproved,
  onRequestAccess,
}) => {
  const activeCount = jobs.filter((j) => j.status === 'processing' || j.status === 'waiting').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const hasAdminToken = Boolean(typeof window !== 'undefined' && localStorage.getItem('etebox_admin_token'));

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Film className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                ETEBOX
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 font-semibold">
                VIP WATERMARK
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Fast Video Watermarking Engine • Animated & Static
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Access status badge in private mode */}
          {accessMode === 'private' && (
            <div>
              {isApproved || hasAdminToken ? (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  {hasAdminToken ? 'مسؤول (Admin)' : 'مصرّح بالاستخدام'}
                </span>
              ) : (
                <button
                  onClick={onRequestAccess}
                  className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  طلب تصريح
                </button>
              )}
            </div>
          )}

          {/* Queue Monitor Button */}
          <button
            onClick={onScrollToQueue}
            className="relative flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs sm:text-sm font-medium transition-all"
            title="View Processing Queue"
          >
            <ListOrdered className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Queue</span>
            {activeCount > 0 ? (
              <span className="flex items-center justify-center px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-xs font-bold animate-pulse">
                {activeCount} active
              </span>
            ) : completedCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                {completedCount} ready
              </span>
            ) : null}
          </button>

          {/* Admin Button */}
          <button
            onClick={onOpenAdmin}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
              hasAdminToken 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/70 text-slate-300'
            }`}
            title="Administrator Panel"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{hasAdminToken ? 'لوحة الأدمن' : 'Admin'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
