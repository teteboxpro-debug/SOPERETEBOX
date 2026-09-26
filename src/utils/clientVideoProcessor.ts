import type { WatermarkConfig, VideoMetadata } from '../types.js';

export interface ProcessingProgressCallback {
  (progress: number, elapsedSec: number, remainingSec: number): void;
}

// Global registry of user's local video File/Blob references
// Stored purely in browser memory/session so zero video bytes are ever uploaded to the server
const localVideoFiles = new Map<string, File | Blob>();

export function registerLocalVideoFile(id: string, file: File | Blob) {
  localVideoFiles.set(id, file);
}

export function getLocalVideoFile(id: string): File | Blob | undefined {
  return localVideoFiles.get(id);
}

export function removeLocalVideoFile(id: string) {
  localVideoFiles.delete(id);
}

// Calculate base static coordinates (0 to 100%) matching the preview
function getBaseCoords(cfg: WatermarkConfig): { x: number; y: number } {
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
}

// Check watermark visibility at timestamp t
function isWatermarkVisibleAtTime(cfg: WatermarkConfig, t: number, totalDur: number): boolean {
  const mode = cfg.displayMode || (cfg.watermarkEntireVideo ? 'all' : 'range');

  if (mode === 'all') return true;

  if (mode === 'range') {
    const start = Math.max(0, cfg.watermarkStartTime ?? 0);
    const end = Math.min(totalDur, cfg.watermarkEndTime || totalDur);
    return t >= start && t <= end;
  }

  if (mode === 'interval') {
    if (cfg.intervalType === 'repeating') {
      const activeSec = Math.max(0.5, cfg.intervalDuration || 5);
      const periodSec = Math.max(activeSec + 0.5, cfg.intervalPeriod || 15);
      const mod = t % periodSec;
      return mod <= activeSec;
    }

    if (cfg.intervalType === 'custom' && cfg.customIntervals && cfg.customIntervals.length > 0) {
      return cfg.customIntervals.some(
        (inv) => inv.endTime > inv.startTime && t >= inv.startTime && t <= inv.endTime
      );
    }
  }

  return true;
}

// Calculate watermark frame position (0 to 100%)
function calculateFrameCoordinates(
  cfg: WatermarkConfig,
  t: number,
  duration: number
): { xPercent: number; yPercent: number; isVisible: boolean } {
  const isVisible = isWatermarkVisibleAtTime(cfg, t, duration);
  if (!isVisible) {
    return { xPercent: 5, yPercent: 5, isVisible: false };
  }

  const base = getBaseCoords(cfg);
  if (!cfg.isAnimated) {
    return { xPercent: base.x, yPercent: base.y, isVisible: true };
  }

  const animStart = cfg.animateEntireVideo ? 0 : cfg.animationStartTime;
  const animEnd = cfg.animateEntireVideo ? duration : cfg.animationEndTime || duration;

  if (t < animStart || t > animEnd) {
    return { xPercent: base.x, yPercent: base.y, isVisible: true };
  }

  let speedMult = 1.0;
  if (cfg.animationSpeed === 'slow') speedMult = 0.5;
  else if (cfg.animationSpeed === 'fast') speedMult = 2.0;
  else if (cfg.animationSpeed === 'very-fast') speedMult = 3.5;
  else if (cfg.animationSpeed === 'custom') speedMult = cfg.customSpeedMultiplier || 1.0;

  const reps = cfg.numberOfRepetitions && cfg.numberOfRepetitions > 0 ? cfg.numberOfRepetitions : 1;
  const animDuration = Math.max(0.5, animEnd - animStart);
  const period = Math.max(0.5, animDuration / (reps * speedMult));

  const timeInPeriod = (t - animStart) % period;
  let u = timeInPeriod / period;

  if (cfg.isDiscreteJump) {
    const steps = Math.max(1, cfg.numberOfMovements || 4);
    u = Math.floor(u * steps) / steps;
  }

  const margin = 5;
  const maxBound = 90;
  let animX = base.x;
  let animY = base.y;

  switch (cfg.animationPattern) {
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
    case 'all-positions': {
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
  }

  return { xPercent: animX, yPercent: animY, isVisible: true };
}

// Select best supported MIME type for client video recording
function getBestSupportedMimeType(): string {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  if (typeof MediaRecorder !== 'undefined') {
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
  }
  return 'video/webm';
}

/**
 * Process video entirely in the client browser using HTML5 Canvas & MediaRecorder.
 * Zero bytes of the user's video are sent to the server.
 */
export async function processVideoClientSide(
  videoSource: string | File | Blob,
  videoMeta: VideoMetadata,
  watermarkConfig: WatermarkConfig,
  onProgress?: ProcessingProgressCallback
): Promise<{ blob: Blob; url: string; size: number }> {
  return new Promise(async (resolve, reject) => {
    let sourceUrl = '';
    let shouldRevokeSourceUrl = false;

    if (typeof videoSource === 'string') {
      sourceUrl = videoSource;
    } else {
      sourceUrl = URL.createObjectURL(videoSource);
      shouldRevokeSourceUrl = true;
    }

    const videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.muted = false; // Audio tracks need to be played internally
    videoEl.playsInline = true;
    videoEl.preload = 'auto';

    // Preload logo image if configured
    let logoImg: HTMLImageElement | null = null;
    const hasLogo =
      (watermarkConfig.type === 'image' || watermarkConfig.type === 'both') &&
      Boolean(watermarkConfig.logoUrl);

    if (hasLogo && watermarkConfig.logoUrl) {
      try {
        logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = watermarkConfig.logoUrl;
        await new Promise((res) => {
          if (!logoImg) return res(null);
          logoImg.onload = () => res(null);
          logoImg.onerror = () => res(null);
        });
      } catch {
        logoImg = null;
      }
    }

    videoEl.src = sourceUrl;

    const cleanup = () => {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
      if (shouldRevokeSourceUrl && sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };

    videoEl.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video source for client processing.'));
    };

    videoEl.onloadedmetadata = async () => {
      const width = videoEl.videoWidth || videoMeta.width || 1280;
      const height = videoEl.videoHeight || videoMeta.height || 720;
      const duration = videoEl.duration || videoMeta.duration || 10;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        cleanup();
        return reject(new Error('Canvas 2D context not available.'));
      }

      // Audio stream extraction
      let audioTrack: MediaStreamTrack | null = null;
      let audioCtx: AudioContext | null = null;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          const sourceNode = audioCtx.createMediaElementSource(videoEl);
          const destNode = audioCtx.createMediaStreamDestination();
          sourceNode.connect(destNode);
          audioTrack = destNode.stream.getAudioTracks()[0] || null;
        }
      } catch {
        // Continue if WebAudio is restricted
      }

      // Capture canvas stream at 30 FPS
      const canvasStream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).mozCaptureStream?.(30);
      if (!canvasStream) {
        cleanup();
        return reject(new Error('Canvas stream capture is not supported in this browser.'));
      }

      const tracks: MediaStreamTrack[] = [canvasStream.getVideoTracks()[0]];
      if (audioTrack) {
        tracks.push(audioTrack);
      }
      const combinedStream = new MediaStream(tracks);

      const mimeType = getBestSupportedMimeType();
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 6000000, // 6 Mbps high quality
        });
      } catch {
        mediaRecorder = new MediaRecorder(combinedStream);
      }

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch {}
        }
        cleanup();

        const finalBlob = new Blob(chunks, { type: mimeType.split(';')[0] || 'video/mp4' });
        const finalUrl = URL.createObjectURL(finalBlob);
        resolve({
          blob: finalBlob,
          url: finalUrl,
          size: finalBlob.size,
        });
      };

      mediaRecorder.start(200); // 200ms slice for low memory overhead

      const startTime = Date.now();
      let isRendering = true;

      // Draw watermark on canvas context
      const drawWatermark = (t: number) => {
        if (watermarkConfig.type === 'none' || watermarkConfig.isWatermarkDeleted) {
          return;
        }

        const { xPercent, yPercent, isVisible } = calculateFrameCoordinates(
          watermarkConfig,
          t,
          duration
        );

        if (!isVisible) return;

        ctx.save();
        const opacity = Math.max(0.1, Math.min(1.0, (watermarkConfig.opacityPercent || 100) / 100));
        ctx.globalAlpha = opacity;

        const posX = (xPercent / 100) * width;
        const posY = (yPercent / 100) * height;

        // Draw Logo Image
        if (
          logoImg &&
          (watermarkConfig.type === 'image' || watermarkConfig.type === 'both')
        ) {
          const logoWPercent = watermarkConfig.logoSizePercent || watermarkConfig.sizePercent || 15;
          const logoW = (logoWPercent / 100) * width;
          const logoH = logoW * (logoImg.naturalHeight / (logoImg.naturalWidth || 1));
          ctx.drawImage(logoImg, posX - logoW / 2, posY - logoH / 2, logoW, logoH);
        }

        // Draw Text Watermark
        const hasText =
          (watermarkConfig.type === 'text' || watermarkConfig.type === 'both') &&
          watermarkConfig.text &&
          watermarkConfig.text.trim().length > 0;

        if (hasText) {
          const fontSizePercent = watermarkConfig.textSizePercent || watermarkConfig.fontSizePercent || 5;
          const fontSize = Math.max(12, (fontSizePercent / 100) * height);
          const fontStyle = `${watermarkConfig.textItalic ? 'italic ' : ''}${
            watermarkConfig.textBold ? 'bold ' : ''
          }${fontSize}px ${watermarkConfig.fontFamily || 'sans-serif'}`;

          ctx.font = fontStyle;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Shadow
          if (watermarkConfig.textShadow) {
            ctx.shadowColor = watermarkConfig.shadowColor || 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = Math.max(2, fontSize * 0.15);
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
          }

          // Outline
          if (watermarkConfig.textOutline) {
            ctx.strokeStyle = watermarkConfig.outlineColor || '#000000';
            ctx.lineWidth = watermarkConfig.outlineWidth || Math.max(2, fontSize * 0.1);
            ctx.strokeText(watermarkConfig.text, posX, posY);
          }

          // Fill
          ctx.fillStyle = watermarkConfig.textColor || '#ffffff';
          ctx.fillText(watermarkConfig.text, posX, posY);
        }

        ctx.restore();
      };

      // Frame rendering loop
      const renderFrame = () => {
        if (!isRendering) return;

        if (videoEl.ended || videoEl.currentTime >= duration) {
          isRendering = false;
          if (onProgress) {
            onProgress(100, Math.round((Date.now() - startTime) / 1000), 0);
          }
          setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 300);
          return;
        }

        // Draw video frame to canvas
        ctx.drawImage(videoEl, 0, 0, width, height);

        // Draw watermark
        const cur = videoEl.currentTime;
        drawWatermark(cur);

        // Progress computation
        const progress = Math.min(99, Math.round((cur / duration) * 100));
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const estimatedTotal = progress > 0 ? (elapsed / progress) * 100 : duration;
        const remaining = Math.max(0, Math.round(estimatedTotal - elapsed));

        if (onProgress) {
          onProgress(progress, elapsed, remaining);
        }

        if ('requestVideoFrameCallback' in videoEl) {
          (videoEl as any).requestVideoFrameCallback(renderFrame);
        } else {
          requestAnimationFrame(renderFrame);
        }
      };

      try {
        await videoEl.play();
        renderFrame();
      } catch (err: any) {
        cleanup();
        reject(new Error(`Could not play video for processing: ${err?.message || err}`));
      }
    };
  });
}
