import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Sparkles,
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Plus
} from 'lucide-react';

import type {
  VideoMetadata,
  WatermarkConfig,
  QueueJob,
  SystemSettings,
  AccessRequest
} from './types.js';

import { Header } from './components/Header.js';
import { VideoUploadZone } from './components/VideoUploadZone.js';
import { WatermarkConfigurator } from './components/WatermarkConfigurator.js';
import { LiveVideoPreview } from './components/LiveVideoPreview.js';
import { QueueManager } from './components/QueueManager.js';
import { AdminModal } from './components/AdminModal.js';
import { AccessRequestModal } from './components/AccessRequestModal.js';
import { getLocalVideoFile, processVideoClientSide } from './utils/clientVideoProcessor.js';

export default function App() {
  // Video & Configuration States
  const [currentVideo, setCurrentVideo] = useState<VideoMetadata | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Default Watermark Configuration (empty by default so user's video has NO unwanted logo or text watermark)
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    type: 'none',
    text: '',
    textColor: '#ffffff',
    fontSizePercent: 8,
    textSizePercent: 8,
    fontFamily: 'sans-serif',
    textBold: true,
    textItalic: false,
    textOutline: true,
    outlineColor: '#000000',
    textShadow: true,
    shadowColor: '#000000',
    logoUrl: undefined,
    logoFilename: undefined,
    sizePercent: 25,
    logoSizePercent: 25,
    opacityPercent: 85,
    position: 'center',
    customXPercent: 50,
    customYPercent: 50,
    watermarkEntireVideo: true,
    displayMode: 'all',
    watermarkStartTime: 0,
    watermarkEndTime: 60,
    watermarkDuration: 60,
    intervalType: 'repeating',
    intervalDuration: 5,
    intervalPeriod: 20,
    customIntervals: [],
    isAnimated: false,
    animationPattern: 'diagonal',
    numberOfMovements: 4,
    numberOfRepetitions: 2,
    animateEntireVideo: true,
    animationStartTime: 0,
    animationEndTime: 60,
    animationSpeed: 'normal',
    isDiscreteJump: false,
    isWatermarkDeleted: false,
    isNewlySelected: false,
  });

  // Processing Queue
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // System & Access Status
  const [accessMode, setAccessMode] = useState<'public' | 'private'>('private');
  const [isApproved, setIsApproved] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [adminContactEmail, setAdminContactEmail] = useState('ETEBOXVIP@GMAIL.COM');
  const [existingAccessReq, setExistingAccessReq] = useState<AccessRequest | null>(null);
  const [maxVideosPerUser, setMaxVideosPerUser] = useState(3);

  // Modals
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);

  // Client ID helper for stable session identification
  const getClientId = () => {
    let cid = typeof window !== 'undefined' ? localStorage.getItem('etebox_client_id') : null;
    if (!cid) {
      cid = 'client_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('etebox_client_id', cid);
    }
    return cid;
  };

  // Fetch initial access status and jobs
  const fetchStatus = async () => {
    try {
      const adminToken = localStorage.getItem('etebox_admin_token');
      const clientId = getClientId();
      const headers: Record<string, string> = {
        'x-client-id': clientId,
      };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch('/api/access-status', { headers });
      const data = await res.json();
      if (data.success) {
        setAccessMode(data.accessMode || data.settings?.accessMode || 'private');
        const approved = Boolean(adminToken) || Boolean(data.user?.isApproved);
        setIsApproved(approved);
        setIsBlocked(data.user?.isBlocked ?? false);
        if (data.adminContactEmail) {
          setAdminContactEmail(data.adminContactEmail);
        }
        setMaxVideosPerUser(data.settings?.maxVideosPerUser || 3);
        if (data.accessRequest) {
          setExistingAccessReq(data.accessRequest);
        }
      }
    } catch (e) {
      console.error('Failed to fetch access status:', e);
    }
  };

  // Poll jobs list with visibility awareness and resilient retry
  const fetchJobs = async () => {
    // If tab is hidden and no active jobs are running, pause polling to save network
    if (document.hidden && !jobs.some((j) => j.status === 'processing' || j.status === 'waiting')) {
      return;
    }

    try {
      const adminToken = localStorage.getItem('etebox_admin_token');
      const clientId = getClientId();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'x-client-id': clientId,
      };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      const res = await fetch('/api/jobs', { headers });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      if (data && data.success && Array.isArray(data.jobs)) {
        setJobs((prevJobs) => {
          const localMap = new Map(prevJobs.map((j) => [j.id, j]));
          return data.jobs.map((serverJob: QueueJob) => {
            const local = localMap.get(serverJob.id);
            if (local) {
              return {
                ...serverJob,
                outputUrl: local.outputUrl || serverJob.outputUrl,
                outputSize: local.outputSize || serverJob.outputSize,
                status: local.status === 'completed' ? 'completed' : (local.status || serverJob.status),
                processingProgress: local.status === 'completed' ? 100 : (local.processingProgress ?? serverJob.processingProgress),
                elapsedTimeSec: local.elapsedTimeSec ?? serverJob.elapsedTimeSec,
                estimatedRemainingSec: local.estimatedRemainingSec ?? serverJob.estimatedRemainingSec,
              };
            }
            return serverJob;
          });
        });
      }
    } catch {
      // Quietly ignore transient network drops or server reloads during dev
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchJobs();

    // Responsive polling: 2.5s default interval, runs cleanly without console spam
    const interval = setInterval(fetchJobs, 2500);
    return () => clearInterval(interval);
  }, []);

  // Update watermark configuration when video duration is known
  const handleVideoSelected = (video: VideoMetadata) => {
    setCurrentVideo(video);
    setWatermarkConfig((prev) => ({
      ...prev,
      watermarkEndTime: video.duration,
      watermarkDuration: video.duration,
      animationEndTime: video.duration,
    }));
  };

  // Drag-to-position on preview update
  const handleCustomPositionChange = (x: number, y: number) => {
    setWatermarkConfig((prev) => ({
      ...prev,
      position: 'custom',
      customXPercent: x,
      customYPercent: y,
      isAnimated: false, // Ensure dragging explicitly sets a fixed static position
    }));
  };

  // Lock watermark in current fixed static position
  const handleLockStatic = () => {
    setWatermarkConfig((prev) => ({
      ...prev,
      isAnimated: false,
    }));
  };

  // Completely delete and purge watermark from current project/video state
  const handleDeleteWatermark = () => {
    setWatermarkConfig((prev) => ({
      ...prev,
      type: 'none',
      text: '',
      logoUrl: undefined,
      logoFilename: undefined,
      isWatermarkDeleted: true,
      isNewlySelected: false,
      isAnimated: false,
    }));
  };

  // Start processing & enqueue
  const handleStartProcessing = async () => {
    if (!currentVideo) return;
    if (!isApproved) {
      setIsAccessModalOpen(true);
      return;
    }
    setSubmitError(null);
    setIsSubmittingJob(true);

    try {
      const adminToken = localStorage.getItem('etebox_admin_token');
      const clientId = getClientId();
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-client-id': clientId,
      };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      // 1. Register job metadata with the server (zero video file data transferred)
      const res = await fetch('/api/process', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          video: currentVideo,
          watermarkConfig,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.job) {
        setSubmitError(data.error || 'Failed to submit video for processing.');
        return;
      }

      const newJob: QueueJob = {
        ...data.job,
        status: 'processing',
        processingProgress: 0,
      };

      // Update UI immediately
      setJobs((prev) => [newJob, ...prev.filter((j) => j.id !== newJob.id)]);

      // Scroll to queue manager section
      const queueElem = document.getElementById('processing-queue');
      if (queueElem) {
        queueElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // 2. Start client-side video processing directly on user's device/connection
      const videoSource = getLocalVideoFile(currentVideo.id) || currentVideo.url;

      const syncJob = (
        status: 'processing' | 'completed' | 'failed',
        pct: number,
        elapsed: number,
        rem: number,
        outputSize?: number,
        outputUrl?: string
      ) => {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === newJob.id
              ? {
                  ...j,
                  status,
                  processingProgress: pct,
                  elapsedTimeSec: elapsed,
                  estimatedRemainingSec: rem,
                  totalProcessingTimeSec: elapsed,
                  outputSize: outputSize || j.outputSize,
                  outputUrl: outputUrl || j.outputUrl,
                }
              : j
          )
        );

        // Lightweight status sync (metadata only, zero video bytes)
        fetch(`/api/jobs/${newJob.id}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            status,
            processingProgress: pct,
            elapsedTimeSec: elapsed,
            estimatedRemainingSec: rem,
            totalProcessingTimeSec: elapsed,
            outputSize,
          }),
        }).catch(() => {});
      };

      processVideoClientSide(videoSource, currentVideo, watermarkConfig, (pct, elapsed, rem) => {
        syncJob('processing', pct, elapsed, rem);
      })
        .then((result) => {
          syncJob('completed', 100, newJob.elapsedTimeSec || 1, 0, result.size, result.url);
        })
        .catch((err) => {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === newJob.id
                ? {
                    ...j,
                    status: 'failed',
                    errorMessage: err.message || 'Processing failed.',
                  }
                : j
            )
          );
        });

    } catch (err: any) {
      setSubmitError(err.message || 'Network error while submitting processing job.');
    } finally {
      setIsSubmittingJob(false);
    }
  };

  // Cancel / Delete a job from the queue
  const handleCancelJob = async (jobId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      fetchJobs();
    } catch (e) {
      console.error('Error cancelling job:', e);
    }
  };

  // Add another video action
  const handleAddAnotherVideo = () => {
    setCurrentVideo(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToQueue = () => {
    const queueElem = document.getElementById('processing-queue');
    if (queueElem) {
      queueElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const canQueueMore = jobs.length < maxVideosPerUser;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-400 selection:text-slate-950">
      {/* Top Application Bar */}
      <Header
        onOpenAdmin={() => setIsAdminOpen(true)}
        onScrollToQueue={scrollToQueue}
        jobs={jobs}
        accessMode={accessMode}
        isApproved={isApproved}
        onRequestAccess={() => setIsAccessModalOpen(true)}
      />

      {/* Blocked Account Notice */}
      {isBlocked && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs px-4 py-2.5 text-center font-semibold">
          تم حظر الحساب من قبل مسؤول النظام. يرجى التواصل مع الإدارة.
        </div>
      )}

      {/* Permission Notice (only shown when not approved and accessMode is private) */}
      {!isApproved && accessMode === 'private' && (
        <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/15 border-b border-amber-500/20 text-amber-200 text-xs px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              {existingAccessReq
                ? `طلب التصريح قيد المراجعة لدى الإدارة. للتواصل:`
                : `يتطلب استخدام المنصة تصريحاً من الإدارة. للتواصل:`}
              {' '}
              <a
                href={`mailto:${adminContactEmail}?subject=طلب تصريح تطبيق ETEBOX VIP`}
                className="font-bold underline text-amber-400 hover:text-white font-mono ml-1"
              >
                {adminContactEmail}
              </a>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAccessModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all"
            >
              {existingAccessReq ? 'تفاصيل الطلب' : 'طلب تصريح'}
            </button>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
            >
              دخول الأدمن
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Step 1: Upload Video Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center space-x-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-mono font-bold">
                1
              </span>
              <span>Upload Video Source</span>
            </h2>
            {currentVideo && (
              <span className="text-xs text-slate-400">
                Resolution: <strong className="text-amber-400">{currentVideo.width}×{currentVideo.height}</strong>
              </span>
            )}
          </div>

          <VideoUploadZone
            currentVideo={currentVideo}
            onVideoSelected={handleVideoSelected}
            onClearVideo={() => setCurrentVideo(null)}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            isAuthorized={isApproved}
            onBlockedAction={() => setIsAccessModalOpen(true)}
          />
        </section>

        {/* Step 2: Configure & Live Preview */}
        {currentVideo && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center space-x-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-mono font-bold">
                  2
                </span>
                <span>Configure Watermark & Live Preview</span>
              </h2>

              <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Instant Real-Time Preview</span>
              </span>
            </div>

            {/* Split Screen Layout: Left = Configurator, Right = Live Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Watermark Controls */}
              <div className="lg:col-span-6 space-y-4">
                <WatermarkConfigurator
                  config={watermarkConfig}
                  onChange={setWatermarkConfig}
                  video={currentVideo}
                  onDeleteWatermark={handleDeleteWatermark}
                />
              </div>

              {/* Right Column: Live Video Preview + Action CTA */}
              <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-20">
                <LiveVideoPreview
                  video={currentVideo}
                  config={watermarkConfig}
                  onCustomPositionChange={handleCustomPositionChange}
                  onLockStatic={handleLockStatic}
                  onDeleteWatermark={handleDeleteWatermark}
                />

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Primary CTA: Process Video Button */}
                <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Ready to Render?
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Preset: veryfast • Preserves 100% video resolution & audio quality
                      </span>
                    </div>

                    <button
                      onClick={handleStartProcessing}
                      disabled={isSubmittingJob || !canQueueMore || (accessMode === 'private' && !isApproved)}
                      className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg transition-all ${
                        canQueueMore && !(accessMode === 'private' && !isApproved)
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {isSubmittingJob
                          ? 'Submitting...'
                          : !canQueueMore
                          ? 'Queue Limit Reached'
                          : 'Start Processing'}
                      </span>
                    </button>
                  </div>

                  {/* Explicit Render Placement Notification Confirmation */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Watermark Position: <strong className="text-amber-400 font-mono font-bold">
                          X {watermarkConfig.position === 'center' ? '50%' : (watermarkConfig.position === 'custom' ? `${watermarkConfig.customXPercent}%` : (watermarkConfig.position.includes('left') ? '5%' : watermarkConfig.position.includes('right') ? '95%' : '50%'))}, Y {watermarkConfig.position === 'center' ? '50%' : (watermarkConfig.position === 'custom' ? `${watermarkConfig.customYPercent}%` : (watermarkConfig.position.includes('top') ? '5%' : watermarkConfig.position.includes('bottom') ? '95%' : '50%'))}
                        </strong>
                        <span className="text-slate-400 ml-1.5 font-sans">
                          ({watermarkConfig.position === 'custom' ? 'Custom Coordinates' : watermarkConfig.position.toUpperCase()})
                        </span>
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                      {watermarkConfig.isAnimated && watermarkConfig.position !== 'center' ? '⚡ Animated Movement' : '✓ 1:1 Exact Render Parity'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Multi-Video Processing Queue & Download Monitor */}
        <section className="space-y-4">
          <QueueManager
            jobs={jobs}
            maxVideosPerUser={maxVideosPerUser}
            onAddAnotherVideo={handleAddAnotherVideo}
            onCancelJob={handleCancelJob}
            canAddMore={canQueueMore}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-400">ETEBOX VIP Video Engine</span>
            <span>•</span>
            <span>Standalone Web Platform</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <span>Dynamic FFmpeg Pipeline</span>
            <span>Zero Quality Loss</span>
            <span>Concurrent FIFO Queue</span>
          </div>
        </div>
      </footer>

      {/* Admin Panel Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onSettingsUpdated={fetchStatus}
      />

      {/* Access Request Modal */}
      <AccessRequestModal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        existingRequest={existingAccessReq}
        adminEmail={adminContactEmail}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onInstantApproved={() => {
          setIsApproved(true);
          fetchStatus();
        }}
        onRequestSubmitted={(req) => {
          setExistingAccessReq(req);
          fetchStatus();
        }}
      />
    </div>
  );
}
