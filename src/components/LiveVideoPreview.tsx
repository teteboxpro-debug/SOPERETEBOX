import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Eye,
  EyeOff,
  Move,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import type { WatermarkConfig, VideoMetadata } from '../types.js';

interface LiveVideoPreviewProps {
  video: VideoMetadata;
  config: WatermarkConfig;
  onCustomPositionChange?: (xPercent: number, yPercent: number) => void;
  onLockStatic?: () => void;
  onDeleteWatermark?: () => void;
}

export const LiveVideoPreview: React.FC<LiveVideoPreviewProps> = ({
  video,
  config,
  onCustomPositionChange,
  onLockStatic,
  onDeleteWatermark,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 10);
  const [isMuted, setIsMuted] = useState(true);
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);

  // Check if watermark is configured and active
  const hasLogo = Boolean((config.type === 'image' || config.type === 'both') && config.logoUrl);
  const hasText = Boolean((config.type === 'text' || config.type === 'both') && config.text && config.text.trim().length > 0);
  const hasActiveWatermark =
    config.type !== 'none' &&
    !config.isWatermarkDeleted &&
    (hasLogo || hasText);

  // Position state calculated per frame
  const [coords, setCoords] = useState<{ xPercent: number; yPercent: number; isVisible: boolean }>({
    xPercent: 50,
    yPercent: 50,
    isVisible: true,
  });

  // Calculate static base coordinates matching exact FFmpeg positioning
  // Calculate static base coordinates matching exact normalized positioning (0% to 100%)
  const getBaseCoords = useCallback(
    (cfg: WatermarkConfig) => {
      let x = 50;
      let y = 50;
      switch (cfg.position) {
        case 'top-left':
          x = 5;
          y = 5;
          break;
        case 'top-center':
          x = 50;
          y = 5;
          break;
        case 'top-right':
          x = 95;
          y = 5;
          break;
        case 'middle-left':
          x = 5;
          y = 50;
          break;
        case 'center':
          x = 50;
          y = 50;
          break;
        case 'middle-right':
          x = 95;
          y = 50;
          break;
        case 'bottom-left':
          x = 5;
          y = 95;
          break;
        case 'bottom-center':
          x = 50;
          y = 95;
          break;
        case 'bottom-right':
          x = 95;
          y = 95;
          break;
        case 'custom':
        default:
          x = typeof cfg.customXPercent === 'number' ? Math.max(0, Math.min(100, cfg.customXPercent)) : 50;
          y = typeof cfg.customYPercent === 'number' ? Math.max(0, Math.min(100, cfg.customYPercent)) : 50;
          break;
      }
      return { x, y };
    },
    []
  );

  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 360,
  });

  // Track preview stage dimensions to guarantee 1:1 mathematical scaling with video resolution
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setStageDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Check if watermark is visible at timestamp t
  const isWatermarkVisibleAtTime = useCallback(
    (t: number, totalDur: number): boolean => {
      const mode = config.displayMode || (config.watermarkEntireVideo ? 'all' : 'range');

      if (mode === 'all') {
        return true;
      }

      if (mode === 'range') {
        const start = Math.max(0, config.watermarkStartTime ?? 0);
        const end = Math.min(totalDur, config.watermarkEndTime || totalDur);
        return t >= start && t <= end;
      }

      if (mode === 'interval') {
        if (config.intervalType === 'repeating') {
          const activeSec = Math.max(0.5, config.intervalDuration || 5);
          const periodSec = Math.max(activeSec + 0.5, config.intervalPeriod || 15);
          const mod = t % periodSec;
          return mod <= activeSec;
        }

        if (config.intervalType === 'custom' && config.customIntervals && config.customIntervals.length > 0) {
          return config.customIntervals.some(
            (inv) => inv.endTime > inv.startTime && t >= inv.startTime && t <= inv.endTime
          );
        }
      }

      return true;
    },
    [config]
  );

  // Compute animated coordinates given current timestamp
  const calculateFrameCoordinates = useCallback(
    (t: number) => {
      // 1. Check overall watermark display time visibility
      const isVisible = isWatermarkVisibleAtTime(t, duration);

      if (!isVisible) {
        return { xPercent: 5, yPercent: 5, isVisible: false };
      }

      const base = getBaseCoords(config);

      // If not animated, return base position
      if (!config.isAnimated) {
        return { xPercent: base.x, yPercent: base.y, isVisible: true };
      }

      // Check animation time window
      const animStart = config.animateEntireVideo ? 0 : config.animationStartTime;
      const animEnd = config.animateEntireVideo ? duration : config.animationEndTime || duration;

      if (t < animStart || t > animEnd) {
        return { xPercent: base.x, yPercent: base.y, isVisible: true };
      }

      // Calculate speed and repetitions
      let speedMult = 1.0;
      if (config.animationSpeed === 'slow') speedMult = 0.5;
      else if (config.animationSpeed === 'fast') speedMult = 2.0;
      else if (config.animationSpeed === 'very-fast') speedMult = 3.5;
      else if (config.animationSpeed === 'custom') speedMult = config.customSpeedMultiplier || 1.0;

      const reps = config.numberOfRepetitions && config.numberOfRepetitions > 0 ? config.numberOfRepetitions : 1;
      const animDuration = Math.max(0.5, animEnd - animStart);
      const period = Math.max(0.5, animDuration / (reps * speedMult));

      const timeInPeriod = (t - animStart) % period;
      let u = timeInPeriod / period; // 0.0 to 1.0

      if (config.isDiscreteJump) {
        const steps = Math.max(1, config.numberOfMovements || 4);
        u = Math.floor(u * steps) / steps;
      }

      const margin = 5;
      const maxBound = 90;
      let animX = base.x;
      let animY = base.y;

      switch (config.animationPattern) {
        case 'horizontal':
          animX = margin + (maxBound - margin) * u;
          animY = base.y;
          break;
        case 'vertical':
          animX = base.x;
          animY = margin + (maxBound - margin) * u;
          break;
        case 'diagonal':
          animX = margin + (maxBound - margin) * u;
          animY = margin + (maxBound - margin) * u;
          break;
        case 'reverse-diagonal':
          animX = maxBound - (maxBound - margin) * u;
          animY = margin + (maxBound - margin) * u;
          break;
        case 'rectangle':
          if (u < 0.25) {
            animX = margin + (maxBound - margin) * (u / 0.25);
            animY = margin;
          } else if (u < 0.5) {
            animX = maxBound;
            animY = margin + (maxBound - margin) * ((u - 0.25) / 0.25);
          } else if (u < 0.75) {
            animX = maxBound - (maxBound - margin) * ((u - 0.5) / 0.25);
            animY = maxBound;
          } else {
            animX = margin;
            animY = maxBound - (maxBound - margin) * ((u - 0.75) / 0.25);
          }
          break;
        case 'all-positions':
          // 9 discrete or smooth positions
          const positions = [
            { x: margin, y: margin },
            { x: 50, y: margin },
            { x: maxBound, y: margin },
            { x: maxBound, y: 50 },
            { x: maxBound, y: maxBound },
            { x: 50, y: maxBound },
            { x: margin, y: maxBound },
            { x: margin, y: 50 },
            { x: 50, y: 50 },
          ];
          const posIndex = Math.min(positions.length - 1, Math.floor(u * positions.length));
          animX = positions[posIndex].x;
          animY = positions[posIndex].y;
          break;
      }

      return { xPercent: animX, yPercent: animY, isVisible: true };
    },
    [config, duration, getBaseCoords]
  );

  // Animation frame loop
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      if (videoRef.current) {
        const cur = videoRef.current.currentTime;
        setCurrentTime(cur);
        setCoords(calculateFrameCoordinates(cur));
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [calculateFrameCoordinates]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
      setCoords(calculateFrameCoordinates(val));
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setCoords(calculateFrameCoordinates(0));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Drag on preview to reposition watermark with Pointer Capture (desktop + mobile touch)
  const updatePositionFromPointer = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.round(Math.max(0, Math.min(100, rawX)));
    const clampedY = Math.round(Math.max(0, Math.min(100, rawY)));
    onCustomPositionChange?.(clampedX, clampedY);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasActiveWatermark) return;
    setIsDraggingWatermark(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updatePositionFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWatermark) return;
    updatePositionFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingWatermark) {
      setIsDraggingWatermark(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Watermark styling calculations
  const opacityVal = (config.opacityPercent || 100) / 100;

  // Real-time responsive Logo & Text size calculations tied to actual video aspect container
  const logoSizePercent = config.logoSizePercent ?? config.sizePercent ?? 25;
  const logoPixelWidth = Math.max(16, Math.round(stageDimensions.width * (logoSizePercent / 100)));

  const textSizePercent = config.textSizePercent ?? config.fontSizePercent ?? 8;
  const textPixelFontSize = Math.max(10, Math.round(stageDimensions.height * (textSizePercent / 100)));

  // Text shadow style
  let shadowStyle = 'none';
  if (config.textShadow) {
    shadowStyle = `2px 2px 4px ${config.shadowColor || '#000000'}`;
  }
  let strokeStyle = 'none';
  if (config.textOutline) {
    strokeStyle = `-1px -1px 0 ${config.outlineColor || '#000'}, 1px -1px 0 ${config.outlineColor || '#000'}, -1px 1px 0 ${config.outlineColor || '#000'}, 1px 1px 0 ${config.outlineColor || '#000'}`;
  }

  // Generate visual intervals for the timeline track
  const mode = config.displayMode || (config.watermarkEntireVideo ? 'all' : 'range');
  const activeSegments: Array<{ startPct: number; widthPct: number }> = [];

  if (mode === 'all') {
    activeSegments.push({ startPct: 0, widthPct: 100 });
  } else if (mode === 'range') {
    const s = Math.max(0, config.watermarkStartTime ?? 0);
    const e = Math.min(duration, config.watermarkEndTime || duration);
    if (duration > 0 && e > s) {
      activeSegments.push({
        startPct: (s / duration) * 100,
        widthPct: Math.min(100, ((e - s) / duration) * 100),
      });
    }
  } else if (mode === 'interval') {
    if (config.intervalType === 'repeating') {
      const activeSec = Math.max(0.5, config.intervalDuration || 5);
      const periodSec = Math.max(activeSec + 0.5, config.intervalPeriod || 15);
      if (duration > 0) {
        for (let t = 0; t < duration; t += periodSec) {
          const segDur = Math.min(activeSec, duration - t);
          if (segDur > 0) {
            activeSegments.push({
              startPct: (t / duration) * 100,
              widthPct: (segDur / duration) * 100,
            });
          }
        }
      }
    } else if (config.intervalType === 'custom' && config.customIntervals) {
      if (duration > 0) {
        config.customIntervals.forEach((inv) => {
          if (inv.endTime > inv.startTime) {
            const s = Math.max(0, inv.startTime);
            const e = Math.min(duration, inv.endTime);
            activeSegments.push({
              startPct: (s / duration) * 100,
              widthPct: Math.max(0.5, ((e - s) / duration) * 100),
            });
          }
        });
      }
    }
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
      {/* Live Preview Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Live Video Preview
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>{video.width}×{video.height}</span>
          <span>•</span>
          <span>{video.fps} FPS</span>
        </div>
      </div>

      {/* Prominent Watermark Placement Status Notification & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-950/90 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          {!hasActiveWatermark ? (
            <>
              <span className="h-2 w-2 rounded-full bg-slate-500"></span>
              <span className="text-slate-400 font-semibold">
                ✓ No Watermark Active • Video will export clean
              </span>
            </>
          ) : config.isAnimated && config.position !== 'center' ? (
            <>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-amber-300 font-semibold">
                ⚡ Animated Watermark ({config.animationPattern})
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-emerald-300 font-semibold">
                ✓ Fixed Position: {config.position === 'center' ? 'EXACT CENTER (المنتصف)' : config.position === 'custom' ? `Custom (X: ${config.customXPercent}%, Y: ${config.customYPercent}%)` : config.position.toUpperCase()}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {hasActiveWatermark && config.isAnimated && config.position !== 'center' && (
            <button
              type="button"
              onClick={onLockStatic}
              className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold shadow-sm transition-all"
              title="Lock watermark in static position so it stays fixed"
            >
              Lock in Static Position
            </button>
          )}

          {hasActiveWatermark && onDeleteWatermark && (
            <button
              type="button"
              onClick={onDeleteWatermark}
              className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 transition-all flex items-center space-x-1"
              title="Delete watermark completely from this video"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete Watermark</span>
            </button>
          )}
        </div>
      </div>

      {/* Video Canvas Stage with Responsive Aspect Ratio & Zero Letterboxing */}
      <div className="w-full bg-slate-950 flex items-center justify-center p-2 sm:p-4 overflow-hidden rounded-xl">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative overflow-hidden cursor-crosshair select-none mx-auto shadow-2xl border border-slate-800 touch-none"
          style={{
            aspectRatio: `${video.width || 16} / ${video.height || 9}`,
            maxHeight: '520px',
            maxWidth: '100%',
            width: video.width && video.height
              ? `min(100%, ${(520 * video.width) / video.height}px)`
              : '100%',
          }}
        >
          <video
            ref={videoRef}
            src={video.url}
            muted={isMuted}
            playsInline
            loop
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration || video.duration);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-fill pointer-events-none block"
          />

          {/* Dynamic Watermark Overlay Layer - Only shown when watermark is active and visible */}
          {hasActiveWatermark && coords.isVisible && (
            <div
              className="absolute transition-transform duration-75 pointer-events-none flex flex-col items-center"
              style={{
                left: `${coords.xPercent}%`,
                top: `${coords.yPercent}%`,
                transform: `translate(-${coords.xPercent}%, -${coords.yPercent}%)`,
                opacity: opacityVal,
              }}
            >
              {/* Logo Image */}
              {(config.type === 'image' || config.type === 'both') && config.logoUrl && (
                <img
                  src={config.logoUrl}
                  alt="Watermark Preview"
                  className="object-contain filter drop-shadow-md select-none pointer-events-none"
                  style={{
                    width: `${logoPixelWidth}px`,
                    maxWidth: '95%',
                    maxHeight: `${Math.round(stageDimensions.height * 0.8)}px`,
                  }}
                />
              )}

              {/* Watermark Text */}
              {(config.type === 'text' || config.type === 'both') && config.text && config.text.trim().length > 0 && (
                <div
                  className="whitespace-nowrap select-none leading-tight"
                  style={{
                    fontFamily: config.fontFamily || 'sans-serif',
                    fontSize: `${textPixelFontSize}px`,
                    color: config.textColor || '#ffffff',
                    fontWeight: config.textBold ? 'bold' : 'normal',
                    fontStyle: config.textItalic ? 'italic' : 'normal',
                    textShadow: config.textOutline ? strokeStyle : shadowStyle,
                    marginTop: config.type === 'both' ? '6px' : '0px',
                  }}
                >
                  {config.text}
                </div>
              )}
            </div>
          )}

          {/* Drag Hint Overlay in Custom Mode when watermark is active */}
          {hasActiveWatermark && config.position === 'custom' && (
            <div className="absolute top-2 right-2 pointer-events-none px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur border border-slate-700/60 text-[11px] text-amber-300 flex items-center space-x-1.5 shadow-md">
              <Move className="w-3 h-3 text-amber-400" />
              <span>Click & Drag to Reposition Anywhere</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Control Bar */}
      <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
        {/* Seek timeline */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-semibold text-amber-400 min-w-[42px]">
              {formatTime(currentTime)}
            </span>
            <div className="relative w-full flex items-center">
              <input
                type="range"
                min="0"
                max={duration || 10}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg relative z-10"
              />
            </div>
            <span className="font-mono text-xs text-slate-400 min-w-[42px]">
              {formatTime(duration)}
            </span>
          </div>

          {/* Visual Display Time Track (Active Segments) */}
          <div className="px-14">
            <div className="relative h-2 rounded bg-slate-800/80 overflow-hidden border border-slate-700/50">
              {/* Segments where watermark is visible */}
              {activeSegments.map((seg, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 to-amber-400 opacity-90 shadow-sm shadow-amber-500/50"
                  style={{
                    left: `${seg.startPct}%`,
                    width: `${seg.widthPct}%`,
                  }}
                  title="Watermark Display Segment"
                />
              ))}

              {/* Current playhead indicator line */}
              {duration > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow"
                  style={{ left: `${Math.min(100, (currentTime / duration) * 100)}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span>Watermark Active Period on Timeline</span>
              </span>
              <span className="font-mono text-slate-400">
                {mode === 'all'
                  ? 'Continuous (Full Video)'
                  : mode === 'range'
                  ? `${formatTime(config.watermarkStartTime)} → ${formatTime(config.watermarkEndTime || duration)}`
                  : config.intervalType === 'repeating'
                  ? `Repeating (${config.intervalDuration || 5}s every ${config.intervalPeriod || 15}s)`
                  : `${config.customIntervals?.length || 0} custom intervals`}
              </span>
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={handleRestart}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700"
              title="Restart Video"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={toggleMute}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`px-3 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                coords.isVisible
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {coords.isVisible ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Watermark Displayed</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hidden (Off-Schedule)</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
