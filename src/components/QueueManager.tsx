import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  PlusCircle,
  Film,
  Trash2,
  Sparkles,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import type { QueueJob } from '../types.js';

interface QueueManagerProps {
  jobs: QueueJob[];
  maxVideosPerUser: number;
  onAddAnotherVideo: () => void;
  onCancelJob: (jobId: string) => void;
  canAddMore: boolean;
}

export const QueueManager: React.FC<QueueManagerProps> = ({
  jobs,
  maxVideosPerUser,
  onAddAnotherVideo,
  onCancelJob,
  canAddMore,
}) => {
  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div id="processing-queue" className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-5">
      {/* Queue Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Processing Queue & Export Monitor
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {jobs.length} / {maxVideosPerUser} Videos
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automatic sequential processing • Quality and FPS preserved
          </p>
        </div>

        {/* Add Another Video Button */}
        <div>
          <button
            onClick={onAddAnotherVideo}
            disabled={!canAddMore}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md ${
              canAddMore
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Another Video</span>
          </button>
        </div>
      </div>

      {/* Queue Items List */}
      {jobs.length === 0 ? (
        <div className="py-12 text-center text-slate-500 rounded-xl bg-slate-950/40 border border-slate-800/80">
          <Film className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Queue is Empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Configure your watermark and tap "Start Processing" to begin high-speed rendering.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job, idx) => (
            <div
              key={job.id}
              className={`rounded-xl border p-4 sm:p-5 transition-all ${
                job.status === 'processing'
                  ? 'bg-slate-950 border-amber-500/40 ring-1 ring-amber-500/30 shadow-lg shadow-amber-500/5'
                  : job.status === 'completed'
                  ? 'bg-slate-950/80 border-emerald-500/30'
                  : job.status === 'failed'
                  ? 'bg-slate-950/80 border-rose-500/30'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              {/* Job Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-mono font-bold text-sm ${
                      job.status === 'processing'
                        ? 'bg-amber-500 text-slate-950'
                        : job.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : job.status === 'failed'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                        {job.video.originalName || job.video.filename}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-400 font-mono">
                      <span>{job.video.width}×{job.video.height}</span>
                      <span>•</span>
                      <span>{job.video.fps} FPS</span>
                      <span>•</span>
                      <span>{formatTime(job.video.duration)}</span>
                      {job.watermarkConfig.isAnimated && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-sans font-semibold flex items-center space-x-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Animated</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center space-x-2">
                  {job.status === 'processing' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Processing video...
                    </span>
                  )}

                  {job.status === 'waiting' && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      <Clock className="w-3 h-3 mr-1 text-slate-400" />
                      Waiting (Position {job.queuePosition})
                    </span>
                  )}

                  {job.status === 'completed' && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Completed
                    </span>
                  )}

                  {job.status === 'failed' && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <AlertCircle className="w-3.5 h-3.5 mr-1" />
                      Failed
                    </span>
                  )}

                  {/* Cancel / Delete action */}
                  {(job.status === 'waiting' || job.status === 'completed' || job.status === 'failed') && (
                    <button
                      onClick={() => onCancelJob(job.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* PROCESSING STATE CONTENT */}
              {job.status === 'processing' && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      High-Quality FFmpeg Encoding
                    </span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {job.processingProgress}%
                    </span>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, job.processingProgress)}%` }}
                    />
                  </div>

                  {/* Timing Matrix */}
                  <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Elapsed time:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatTime(job.elapsedTimeSec)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-400 justify-end">
                      <span>Estimated remaining:</span>
                      <span className="font-mono font-semibold text-amber-400">
                        {formatTime(job.estimatedRemainingSec)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* WAITING STATE CONTENT */}
              {job.status === 'waiting' && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span>Queue status:</span>
                    <span className="text-slate-200 font-semibold">
                      Will automatically start when previous job completes
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span>Estimated wait time:</span>
                    <span className="font-mono text-slate-300 font-semibold">
                      ~{formatTime(job.estimatedRemainingSec || 45)}
                    </span>
                  </div>
                </div>
              )}

              {/* COMPLETED STATE CONTENT & DOWNLOAD */}
              {job.status === 'completed' && (
                <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-emerald-400">✅ Video completed</span>
                      <span>•</span>
                      <span>Processing time: <strong className="font-mono text-white">{formatTime(job.totalProcessingTimeSec)}</strong></span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Resolution {job.video.width}×{job.video.height} & {job.video.fps} FPS preserved {job.outputSize ? `(${formatFileSize(job.outputSize)})` : ''}
                    </p>
                  </div>

                  <div>
                    <a
                      href={job.outputUrl || `/api/jobs/${job.id}/download`}
                      download={`etebox_${job.video.originalName || 'watermarked.mp4'}`}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Video</span>
                    </a>
                  </div>
                </div>
              )}

              {/* FAILED STATE CONTENT */}
              {job.status === 'failed' && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-rose-400 flex items-center justify-between">
                  <span>{job.errorMessage || '❌ Processing failed. Please try again.'}</span>
                  <button
                    onClick={() => onCancelJob(job.id)}
                    className="text-xs underline text-slate-400 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
