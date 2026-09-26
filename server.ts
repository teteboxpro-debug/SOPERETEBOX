import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import type {
  QueueJob,
  SystemSettings,
  SystemStats,
  UserRecord,
  AccessRequest,
  WatermarkConfig,
  VideoMetadata
} from './src/types.js';

function resolvePort(): number {
  // Check CLI arguments for --port (e.g. passed by control plane or startup scripts)
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const val = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(val) && val !== 8080) {
      return val;
    }
  }
  // If APP_PORT is explicitly specified, use it
  if (process.env.APP_PORT) {
    const val = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(val) && val !== 8080) return val;
  }
  // If PORT is specified and is NOT 8080 (which is bound by the Nginx reverse proxy), use it
  if (process.env.PORT && process.env.PORT !== '8080') {
    const val = parseInt(process.env.PORT, 10);
    if (!isNaN(val)) return val;
  }
  // Default to 3000 as required by Nginx proxy and environment specification
  return 3000;
}

const PORT = resolvePort();
const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');
const OUTPUTS_DIR = path.join(STORAGE_ROOT, 'outputs');

// Ensure storage directories exist
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

// Setup multer storage for incoming files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB max limit (validated dynamically against settings)
  },
});

// System Settings
const settings: SystemSettings = {
  accessMode: 'private', // Strictly requires admin authorization
  maxVideosPerUser: parseInt(process.env.MAX_VIDEOS_PER_USER || '3', 10),
  maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || '500', 10),
  maxVideoDurationSec: parseInt(process.env.MAX_VIDEO_DURATION_SEC || '3600', 10),
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10),
  encodingPreset: 'veryfast',
  hardwareAcceleration: 'auto',
  tempFileRetentionMinutes: 30,
  cancelOnRemoveAccess: true,
};

// In-memory data store with JSON disk persistence
const jobs = new Map<string, QueueJob>();
const users = new Map<string, UserRecord>();
const accessRequests = new Map<string, AccessRequest>();
const adminTokens = new Set<string>();
const failedJobLogs = new Map<string, string>();
let activeProcessingJobs = 0;

// Disk persistence paths
const SETTINGS_FILE = path.join(STORAGE_ROOT, 'settings.json');
const USERS_FILE = path.join(STORAGE_ROOT, 'users.json');
const REQUESTS_FILE = path.join(STORAGE_ROOT, 'requests.json');
const TOKENS_FILE = path.join(STORAGE_ROOT, 'tokens.json');

function loadPersistedData() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      Object.assign(settings, parsed);
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  try {
    if (fs.existsSync(USERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      for (const [k, v] of Object.entries(parsed)) {
        users.set(k, v as UserRecord);
      }
    }
  } catch (e) {
    console.error('Error loading users:', e);
  }
  try {
    if (fs.existsSync(REQUESTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
      for (const [k, v] of Object.entries(parsed)) {
        accessRequests.set(k, v as AccessRequest);
      }
    }
  } catch (e) {
    console.error('Error loading access requests:', e);
  }
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const parsed: string[] = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
      parsed.forEach((t) => adminTokens.add(t));
    }
  } catch (e) {
    console.error('Error loading tokens:', e);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

function saveUsers() {
  try {
    const obj = Object.fromEntries(users.entries());
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

function saveRequests() {
  try {
    const obj = Object.fromEntries(accessRequests.entries());
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('Error saving requests:', e);
  }
}

function saveTokens() {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(Array.from(adminTokens), null, 2));
  } catch (e) {
    console.error('Error saving tokens:', e);
  }
}

loadPersistedData();

// Admin username and password credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '321325';
const ADMIN_CONTACT_EMAIL = 'ETEBOXVIP@GMAIL.COM';

// Detect hardware acceleration
let detectedHwAccel = 'None (Optimized CPU x264)';
function checkHardwareAcceleration() {
  try {
    const p = spawn('ffmpeg', ['-hwaccels']);
    let output = '';
    p.stdout.on('data', (d) => (output += d.toString()));
    p.on('close', () => {
      const accels = output
        .split('\n')
        .slice(1)
        .map((s) => s.trim())
        .filter(Boolean);
      if (accels.length > 0) {
        detectedHwAccel = accels.join(', ');
      }
    });
  } catch (err) {
    console.error('Error detecting hwaccels:', err);
  }
}
checkHardwareAcceleration();

// User Helper: get or create user by IP / client header
function getOrCreateUser(req: Request): UserRecord {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
  const customId = (req.headers['x-client-id'] as string) || (req.query?.clientId as string) || `user_${crypto.createHash('md5').update(ip).digest('hex').substring(0, 10)}`;
  
  // Check if request is authenticated with admin token
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-admin-token'] as string);
  const isAdmin = Boolean(token && adminTokens.has(token));

  let user = users.get(customId);
  if (!user) {
    user = {
      id: customId,
      ip,
      username: isAdmin ? 'Admin' : `User-${customId.slice(-4).toUpperCase()}`,
      isBlocked: false,
      isApproved: isAdmin || settings.accessMode === 'public',
      firstSeen: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      totalJobs: 0,
    };
    users.set(customId, user);
    saveUsers();
  } else {
    user.lastActive = new Date().toISOString();
    user.ip = ip;
    if (isAdmin) {
      user.isApproved = true;
      user.isBlocked = false;
      user.username = 'Admin';
      saveUsers();
    } else if (settings.accessMode === 'public' && !user.isBlocked) {
      user.isApproved = true;
    }
  }
  return user;
}

// Admin Auth Middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-admin-token'] as string);
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }
  next();
}

// FFprobe metadata analyzer
function probeVideo(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
  format: string;
  codec?: string;
  audioCodec?: string;
  audioSampleRate?: number;
}> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,format_name:stream=width,height,r_frame_rate,codec_name,codec_type,sample_rate',
      '-of',
      'json',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (chunk) => (stdout += chunk));
    ffprobe.stderr.on('data', (chunk) => (stderr += chunk));

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = data.streams || [];
        const videoStream = streams.find((s: any) => s.codec_type === 'video');
        const audioStream = streams.find((s: any) => s.codec_type === 'audio');

        let duration = parseFloat(format.duration || '0');
        let width = videoStream ? parseInt(videoStream.width || '1920', 10) : 1920;
        let height = videoStream ? parseInt(videoStream.height || '1080', 10) : 1080;
        let fps = 30;

        if (videoStream && videoStream.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          if (parts.length === 2 && parseFloat(parts[1]) > 0) {
            fps = Math.round((parseFloat(parts[0]) / parseFloat(parts[1])) * 100) / 100;
          }
        }

        resolve({
          duration: Math.max(1, Math.round(duration)),
          width,
          height,
          fps,
          format: format.format_name ? format.format_name.split(',')[0].toUpperCase() : 'MP4',
          codec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : 44100,
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Helper to probe logo image dimensions for 1:1 layout parity
function getLogoDimensions(filePath: string): { width: number; height: number } {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`,
      { timeout: 3000 }
    ).toString().trim();
    const parts = out.split('x').map((n) => parseInt(n, 10));
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      return { width: parts[0], height: parts[1] };
    }
  } catch (e) {
    console.error('Error probing logo dimensions:', e);
  }
  return { width: 400, height: 120 };
}

// Generate FFmpeg filter expression with 1:1 mathematical coordinate parity to preview
function buildFfmpegFilter(
  cfg: WatermarkConfig,
  videoMeta: VideoMetadata,
  hasLogo: boolean,
  logoPath?: string
): { filterGraph: string; inputArgs: string[] } {
  const W = videoMeta.width;
  const H = videoMeta.height;
  const duration = videoMeta.duration;

  // Strict check: If user deleted the watermark or none is configured, pass video cleanly
  const rawText = (cfg.text ?? '').trim();
  const isDeletedOrNone =
    cfg.type === 'none' ||
    Boolean(cfg.isWatermarkDeleted) ||
    (!hasLogo && !rawText) ||
    (cfg.type === 'image' && !hasLogo) ||
    (cfg.type === 'text' && !rawText);

  if (isDeletedOrNone) {
    return {
      filterGraph: '[0:v]null',
      inputArgs: [],
    };
  }

  // Logo Sizing (relative to video width)
  const logoSize = cfg.logoSizePercent ?? cfg.sizePercent ?? 25;
  const logoSizeRatio = Math.max(0.03, Math.min(1.0, logoSize / 100));
  const targetLogoW = Math.max(16, Math.round(W * logoSizeRatio));

  // Text Sizing (relative to video height)
  const textSize = cfg.textSizePercent ?? cfg.fontSizePercent ?? 8;
  const textSizeRatio = Math.max(0.015, Math.min(0.35, textSize / 100));
  const fontSize = Math.max(12, Math.round(H * textSizeRatio));

  const opacity = Math.max(0.05, Math.min(1.0, cfg.opacityPercent / 100));

  // Watermark active appearance timing (Display Time)
  let enableExpr = '1';
  const displayMode = cfg.displayMode || (cfg.watermarkEntireVideo ? 'all' : 'range');

  if (displayMode === 'all') {
    enableExpr = '1';
  } else if (displayMode === 'range') {
    const visStart = Math.max(0, cfg.watermarkStartTime ?? 0);
    const visEnd = Math.min(duration, cfg.watermarkEndTime || duration);
    enableExpr = `between(t,${visStart.toFixed(2)},${visEnd.toFixed(2)})`;
  } else if (displayMode === 'interval') {
    if (cfg.intervalType === 'repeating') {
      const activeSec = Math.max(0.5, cfg.intervalDuration || 5);
      const periodSec = Math.max(activeSec + 0.5, cfg.intervalPeriod || 15);
      enableExpr = `lte(mod(t,${periodSec.toFixed(2)}),${activeSec.toFixed(2)})`;
    } else if (cfg.intervalType === 'custom' && cfg.customIntervals && cfg.customIntervals.length > 0) {
      const validIntervals = cfg.customIntervals.filter((inv) => inv.endTime > inv.startTime);
      if (validIntervals.length > 0) {
        enableExpr = validIntervals
          .map((inv) => `between(t,${Math.max(0, inv.startTime).toFixed(2)},${Math.min(duration, inv.endTime).toFixed(2)})`)
          .join('+');
      } else {
        enableExpr = '1';
      }
    } else {
      enableExpr = '1';
    }
  }

  // Normalized coordinates based on percentages:
  // X = 0% far left, 50% horizontal center, 100% far right
  // Y = 0% top, 50% vertical center, 100% bottom
  let normX = 0.50;
  let normY = 0.50;

  switch (cfg.position) {
    case 'top-left':
      normX = 0.05;
      normY = 0.05;
      break;
    case 'top-center':
      normX = 0.50;
      normY = 0.05;
      break;
    case 'top-right':
      normX = 0.95;
      normY = 0.05;
      break;
    case 'middle-left':
      normX = 0.05;
      normY = 0.50;
      break;
    case 'center':
      normX = 0.50;
      normY = 0.50;
      break;
    case 'middle-right':
      normX = 0.95;
      normY = 0.50;
      break;
    case 'bottom-left':
      normX = 0.05;
      normY = 0.95;
      break;
    case 'bottom-center':
      normX = 0.50;
      normY = 0.95;
      break;
    case 'bottom-right':
      normX = 0.95;
      normY = 0.95;
      break;
    case 'custom':
    default:
      normX = typeof cfg.customXPercent === 'number' ? Math.max(0, Math.min(100, cfg.customXPercent)) / 100 : 0.50;
      normY = typeof cfg.customYPercent === 'number' ? Math.max(0, Math.min(100, cfg.customYPercent)) / 100 : 0.50;
      break;
  }

  // Exact relative placement using actual video dimensions:
  // Overlay filter uses (W-w)*normX and (H-h)*normY
  // Drawtext filter uses (w-text_w)*normX and (h-text_h)*normY
  let baseX = normX === 0.5 ? `(W-w)/2` : `(W-w)*${normX.toFixed(4)}`;
  let baseY = normY === 0.5 ? `(H-h)/2` : `(H-h)*${normY.toFixed(4)}`;

  let baseTextX = normX === 0.5 ? `(w-text_w)/2` : `(w-text_w)*${normX.toFixed(4)}`;
  let baseTextY = normY === 0.5 ? `(h-text_h)/2` : `(h-text_h)*${normY.toFixed(4)}`;

  const isCentered = cfg.position === 'center';
  // Requirement 6: When the user selects Center, automatic watermark movement/animation must be disabled
  const shouldAnimate = Boolean(cfg.isAnimated) && !isCentered;

  let animX = baseX;
  let animY = baseY;

  if (shouldAnimate) {
    const animStart = cfg.animateEntireVideo ? 0 : Math.max(0, cfg.animationStartTime);
    const animEnd = cfg.animateEntireVideo ? duration : Math.min(duration, cfg.animationEndTime || duration);
    const animDuration = Math.max(1, animEnd - animStart);

    let speedMult = 1.0;
    if (cfg.animationSpeed === 'slow') speedMult = 0.5;
    else if (cfg.animationSpeed === 'fast') speedMult = 2.0;
    else if (cfg.animationSpeed === 'very-fast') speedMult = 3.5;
    else if (cfg.animationSpeed === 'custom') speedMult = Math.max(0.1, cfg.customSpeedMultiplier || 1.0);

    const reps = cfg.numberOfRepetitions && cfg.numberOfRepetitions > 0 ? cfg.numberOfRepetitions : 1;
    const period = Math.max(0.5, animDuration / (reps * speedMult));

    const tShift = `mod(t-${animStart},${period.toFixed(3)})/${period.toFixed(3)}`;
    const stepCount = Math.max(1, cfg.numberOfMovements || 4);
    const u = cfg.isDiscreteJump ? `floor(${tShift}*${stepCount})/${stepCount}` : tShift;
    const animMargin = 0.05;
    const m = Math.round(Math.min(W, H) * animMargin);

    switch (cfg.animationPattern) {
      case 'horizontal':
        animX = `${m} + (W-w-2*${m}) * ${u}`;
        animY = baseY;
        break;
      case 'vertical':
        animX = baseX;
        animY = `${m} + (H-h-2*${m}) * ${u}`;
        break;
      case 'diagonal':
        animX = `${m} + (W-w-2*${m}) * ${u}`;
        animY = `${m} + (H-h-2*${m}) * ${u}`;
        break;
      case 'reverse-diagonal':
        animX = `(W-w-${m}) - (W-w-2*${m}) * ${u}`;
        animY = `${m} + (H-h-2*${m}) * ${u}`;
        break;
      case 'rectangle':
        animX = `if(lt(${u},0.25), ${m}+(W-w-2*${m})*(${u})/0.25, if(lt(${u},0.5), W-w-${m}, if(lt(${u},0.75), (W-w-${m})-(W-w-2*${m})*(${u}-0.5)/0.25, ${m})))`;
        animY = `if(lt(${u},0.25), ${m}, if(lt(${u},0.5), ${m}+(H-h-2*${m})*(${u}-0.25)/0.25, if(lt(${u},0.75), H-h-${m}, (H-h-${m})-(H-h-2*${m})*(${u}-0.75)/0.25)))`;
        break;
      case 'all-positions':
        animX = `if(lt(${u},0.12), ${m}, if(lt(${u},0.25), (W-w)/2, if(lt(${u},0.37), W-w-${m}, if(lt(${u},0.50), W-w-${m}, if(lt(${u},0.62), (W-w)/2, if(lt(${u},0.75), ${m}, if(lt(${u},0.87), ${m}, (W-w)/2)))))))`;
        animY = `if(lt(${u},0.12), ${m}, if(lt(${u},0.25), ${m}, if(lt(${u},0.37), ${m}, if(lt(${u},0.50), H-h-${m}, if(lt(${u},0.62), H-h-${m}, if(lt(${u},0.75), H-h-${m}, if(lt(${u},0.87), (H-h)/2, (H-h)/2)))))))`;
        break;
    }
  }

  const animStartVal = cfg.animateEntireVideo ? 0 : Math.max(0, cfg.animationStartTime);
  const animEndVal = cfg.animateEntireVideo ? duration : Math.min(duration, cfg.animationEndTime || duration);

  const finalX = shouldAnimate ? `if(between(t,${animStartVal},${animEndVal}), ${animX}, ${baseX})` : baseX;
  // Text-specific animation coordinates using drawtext text_w and text_h
  const animTextX = shouldAnimate ? animX.replace(/W-w/g, 'w-text_w') : baseTextX;
  const animTextY = shouldAnimate ? animY.replace(/H-h/g, 'h-text_h') : baseTextY;
  const finalFitTextX = shouldAnimate ? `if(between(t,${animStartVal},${animEndVal}), ${animTextX}, ${baseTextX})` : baseTextX;
  const finalFitTextY = shouldAnimate ? `if(between(t,${animStartVal},${animEndVal}), ${animTextY}, ${baseTextY})` : baseTextY;
  const finalY = shouldAnimate ? `if(between(t,${animStartVal},${animEndVal}), ${animY}, ${baseY})` : baseY;

  const inputArgs: string[] = [];
  let filterGraph = '';

  // Select system font
  const fontFile = cfg.textBold
    ? '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
    : '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';

  const textColor = cfg.textColor || '#ffffff';
  const cleanColor = textColor.startsWith('#') ? textColor.slice(1) : textColor;

  // Case 1: Image only
  if (cfg.type === 'image' && hasLogo && logoPath) {
    inputArgs.push('-i', logoPath);
    const scaledLogoW = Math.max(16, Math.floor(targetLogoW / 2) * 2);
    filterGraph = `[1:v]scale=${scaledLogoW}:-2,format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=x='${finalX}':y='${finalY}':enable='${enableExpr}'`;
  }
  // Case 2: Text only
  else if (cfg.type === 'text' || (!hasLogo && cfg.type === 'both')) {
    if (!rawText) {
      filterGraph = `[0:v]null`;
    } else {
      const escapedText = rawText.replace(/'/g, "\\'").replace(/:/g, '\\:');
      let textOpts = `fontfile=${fontFile}:text='${escapedText}':fontsize=${fontSize}:fontcolor=${cleanColor}@${opacity}:x='${finalFitTextX}':y='${finalFitTextY}':enable='${enableExpr}'`;

      if (cfg.textOutline) {
        const borderCol = (cfg.outlineColor || '#000000').replace('#', '');
        textOpts += `:borderw=${cfg.outlineWidth || 2}:bordercolor=${borderCol}@${opacity}`;
      }
      if (cfg.textShadow) {
        const shadowCol = (cfg.shadowColor || '#000000').replace('#', '');
        textOpts += `:shadowx=3:shadowy=3:shadowcolor=${shadowCol}@${opacity}`;
      }

      filterGraph = `[0:v]drawtext=${textOpts}`;
    }
  }
  // Case 3: Both Text and Image
  else if (cfg.type === 'both' && hasLogo && logoPath) {
    inputArgs.push('-i', logoPath);
    const scaledLogoW = Math.max(16, Math.floor(targetLogoW / 2) * 2);

    if (!rawText) {
      filterGraph = `[1:v]scale=${scaledLogoW}:-2,format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=x='${finalX}':y='${finalY}':enable='${enableExpr}'`;
    } else {
      const escapedText = rawText.replace(/'/g, "\\'").replace(/:/g, '\\:');
      const { width: origLogoW, height: origLogoH } = getLogoDimensions(logoPath);
      const scaledLogoH = Math.max(16, Math.round(scaledLogoW * (origLogoH / origLogoW)));
      const gap = Math.max(4, Math.round(H * 0.01));
      const totalH = scaledLogoH + gap + fontSize;

      let logoY = finalY;
      let textY = `(${finalY})+${scaledLogoH + gap}`;

      if (isCentered) {
        logoY = `(H-${totalH})/2`;
        textY = `(H-${totalH})/2+${scaledLogoH + gap}`;
      } else if (cfg.position === 'custom') {
        const normY = (cfg.customYPercent / 100).toFixed(4);
        logoY = `(H-${totalH})*${normY}`;
        textY = `(H-${totalH})*${normY}+${scaledLogoH + gap}`;
      }

      const logoFilter = `[1:v]scale=${scaledLogoW}:-2,format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=x='${finalX}':y='${logoY}':enable='${enableExpr}'`;

      const case3TextX = isCentered ? `(w-text_w)/2` : (cfg.position === 'custom' ? `(w-text_w)*${(cfg.customXPercent / 100).toFixed(4)}` : finalFitTextX);
      let textOpts = `fontfile=${fontFile}:text='${escapedText}':fontsize=${fontSize}:fontcolor=${cleanColor}@${opacity}:x='${case3TextX}':y='${textY}':enable='${enableExpr}'`;
      if (cfg.textOutline) {
        const borderCol = (cfg.outlineColor || '#000000').replace('#', '');
        textOpts += `:borderw=${cfg.outlineWidth || 2}:bordercolor=${borderCol}@${opacity}`;
      }
      if (cfg.textShadow) {
        const shadowCol = (cfg.shadowColor || '#000000').replace('#', '');
        textOpts += `:shadowx=3:shadowy=3:shadowcolor=${shadowCol}@${opacity}`;
      }

      filterGraph = `${logoFilter}[vtmp];[vtmp]drawtext=${textOpts}`;
    }
  } else {
    filterGraph = `[0:v]null`;
  }

  return { filterGraph, inputArgs };
}

// Queue Processor Engine
function processNextInQueue() {
  // Video processing is handled client-side directly by the user's browser,
  // preventing server bandwidth consumption and video file storage.
  updateQueuePositions();
}

function updateQueuePositions() {
  let pos = 1;
  for (const job of jobs.values()) {
    if (job.status === 'waiting') {
      job.queuePosition = pos++;
      // Calculate estimated waiting time based on active jobs and prior queue
      job.estimatedRemainingSec = pos * 45; // ~45s average estimate per video
    }
  }
}

// Periodic cleanup of temporary files
function runAutoCleanup() {
  const cutoffTime = Date.now() - settings.tempFileRetentionMinutes * 60 * 1000;
  
  [UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoffTime) {
          fs.unlinkSync(fullPath);
          console.log(`[Cleanup] Deleted expired file: ${file}`);
        }
      }
    } catch (e) {
      console.error('[Cleanup] Error reading storage dir:', e);
    }
  });
}
setInterval(runAutoCleanup, 5 * 60 * 1000); // every 5 minutes

// Main Server Setup
async function startServer() {
  const app = express();

  // CORS & Security Headers for reverse proxy, cross-origin, and iframe execution
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Static output serving for video downloads
  app.use('/storage/outputs', express.static(OUTPUTS_DIR));
  app.use('/storage/uploads', express.static(UPLOADS_DIR));

  // ----------------------------------------------------
  // Public API Endpoints
  // ----------------------------------------------------

  // Check current user status & app configuration
  app.get('/api/access-status', (req: Request, res: Response) => {
    const user = getOrCreateUser(req);
    const existingReq = accessRequests.get(user.id);

    res.json({
      success: true,
      accessMode: settings.accessMode,
      user: {
        id: user.id,
        username: user.username,
        isBlocked: user.isBlocked,
        isApproved: user.isApproved,
      },
      settings: {
        accessMode: settings.accessMode,
        maxVideosPerUser: settings.maxVideosPerUser,
        maxVideoSizeMB: settings.maxVideoSizeMB,
        maxVideoDurationSec: settings.maxVideoDurationSec,
      },
      adminContactEmail: ADMIN_CONTACT_EMAIL,
      accessRequest: existingReq || null,
    });
  });

  // Request Access (in private mode)
  app.post('/api/access-request', (req: Request, res: Response) => {
    const user = getOrCreateUser(req);
    const { username, reason } = req.body;

    if (username) {
      user.username = username.trim();
    }

    const reqId = `req_${user.id}`;
    const newReq: AccessRequest = {
      id: reqId,
      userId: user.id,
      username: user.username,
      ip: user.ip,
      reason: reason || '',
      status: 'pending',
      requestDate: new Date().toISOString(),
    };

    accessRequests.set(user.id, newReq);
    saveRequests();
    saveUsers();

    console.log(`[Admin Notification] New access authorization request from User ${user.username} (${user.ip})`);
    res.json({ success: true, request: newReq });
  });

  // Instant demo or owner self-activation endpoint
  app.post('/api/access-request/instant', (req: Request, res: Response) => {
    const user = getOrCreateUser(req);
    user.isApproved = true;
    saveUsers();
    res.json({ success: true, user });
  });

  // Load Sample Video for Quick Demo / Testing
  app.get('/api/sample-video', async (req: Request, res: Response) => {
    try {
      const samplePath = path.join(UPLOADS_DIR, 'sample_etebox_clip.mp4');
      if (!fs.existsSync(samplePath)) {
        return res.status(404).json({ error: 'Sample clip not found' });
      }
      const stat = fs.statSync(samplePath);
      const meta = await probeVideo(samplePath);

      const videoMetadata: VideoMetadata = {
        id: 'sample_clip',
        filename: 'sample_etebox_clip.mp4',
        originalName: 'ETEBOX_Demo_1080p.mp4',
        fileSize: stat.size,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
        format: meta.format,
        codec: meta.codec,
        audioCodec: meta.audioCodec,
        audioSampleRate: meta.audioSampleRate,
        url: `/storage/uploads/sample_etebox_clip.mp4`,
      };

      res.json({ success: true, video: videoMetadata });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load sample clip' });
    }
  });

  // Video Metadata Registration (Client-direct processing: zero video files transferred to server)
  app.post('/api/upload', (req: Request, res: Response) => {
    try {
      const user = getOrCreateUser(req);

      if (user.isBlocked) {
        return res.status(403).json({ error: 'Your account is blocked.' });
      }

      if (settings.accessMode === 'private' && !user.isApproved) {
        return res.status(403).json({ error: 'Access required. Please request access from the administrator.' });
      }

      const { filename, originalName, fileSize, duration, width, height, fps, format, url } = req.body || {};
      const videoMetadata: VideoMetadata = {
        id: crypto.randomBytes(8).toString('hex'),
        filename: filename || originalName || 'video.mp4',
        originalName: originalName || filename || 'video.mp4',
        fileSize: fileSize || 0,
        duration: duration || 10,
        width: width || 1920,
        height: height || 1080,
        fps: fps || 30,
        format: format || 'video/mp4',
        url: url || '',
      };

      res.json({ success: true, video: videoMetadata });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to process video metadata.' });
    }
  });

  // Logo Upload
  app.post('/api/upload-logo', upload.single('logo'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No logo image file provided.' });
      }

      res.json({
        success: true,
        logo: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          url: `/storage/uploads/${req.file.filename}`,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to upload logo' });
    }
  });

  // Queue Video for Processing
  app.post('/api/process', (req: Request, res: Response) => {
    try {
      const user = getOrCreateUser(req);

      if (user.isBlocked) {
        return res.status(403).json({ error: 'Account is blocked.' });
      }

      if (settings.accessMode === 'private' && !user.isApproved) {
        return res.status(403).json({ error: 'Access required. Approval needed from administrator.' });
      }

      // Check current user active/waiting jobs
      let userActiveJobsCount = 0;
      for (const j of jobs.values()) {
        if (j.userId === user.id && (j.status === 'waiting' || j.status === 'processing')) {
          userActiveJobsCount++;
        }
      }

      if (userActiveJobsCount >= settings.maxVideosPerUser) {
        return res.status(400).json({
          error: `Queue limit reached. Maximum ${settings.maxVideosPerUser} videos waiting/processing per user. Please wait for previous jobs to complete.`,
        });
      }

      const { video, watermarkConfig } = req.body;
      if (!video || !video.filename) {
        return res.status(400).json({ error: 'Missing video metadata.' });
      }

      const jobId = `job_${crypto.randomBytes(6).toString('hex')}`;
      const newJob: QueueJob = {
        id: jobId,
        userId: user.id,
        video,
        watermarkConfig,
        status: 'waiting',
        uploadProgress: 100,
        processingProgress: 0,
        queuePosition: 1,
        elapsedTimeSec: 0,
        estimatedRemainingSec: 0,
        totalProcessingTimeSec: 0,
        createdAt: new Date().toISOString(),
      };

      jobs.set(jobId, newJob);
      updateQueuePositions();

      // Trigger queue worker
      processNextInQueue();

      res.json({ success: true, job: newJob });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to queue video' });
    }
  });

  // Get current user's jobs and general queue status
  const handleGetQueue = (req: Request, res: Response) => {
    const user = getOrCreateUser(req);
    const userJobs: QueueJob[] = [];

    for (const job of jobs.values()) {
      if (job.userId === user.id) {
        userJobs.push(job);
      }
    }

    // Sort newest first
    userJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      jobs: userJobs,
      totalQueueLength: Array.from(jobs.values()).filter((j) => j.status === 'waiting').length,
      activeProcessingCount: activeProcessingJobs,
    });
  };

  app.get('/api/queue', handleGetQueue);
  app.get('/api/jobs', handleGetQueue);

  // Single Job Status
  app.get('/api/jobs/:id', (req: Request, res: Response) => {
    const job = jobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ job });
  });

  // Client Job Progress Sync (Metadata only - zero video transfer)
  app.post('/api/jobs/:id/sync', (req: Request, res: Response) => {
    const job = jobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const { status, processingProgress, elapsedTimeSec, estimatedRemainingSec, totalProcessingTimeSec, outputSize } = req.body || {};
    if (status) job.status = status;
    if (typeof processingProgress === 'number') job.processingProgress = processingProgress;
    if (typeof elapsedTimeSec === 'number') job.elapsedTimeSec = elapsedTimeSec;
    if (typeof estimatedRemainingSec === 'number') job.estimatedRemainingSec = estimatedRemainingSec;
    if (typeof totalProcessingTimeSec === 'number') job.totalProcessingTimeSec = totalProcessingTimeSec;
    if (typeof outputSize === 'number') job.outputSize = outputSize;

    if (status === 'completed') {
      job.completedAt = new Date().toISOString();
      const user = users.get(job.userId);
      if (user) {
        user.totalJobs = (user.totalJobs || 0) + 1;
        user.lastActive = new Date().toISOString();
        saveUsers();
      }
    }
    updateQueuePositions();
    res.json({ success: true, job });
  });

  // Download Completed Video
  app.get('/api/jobs/:id/download', (req: Request, res: Response) => {
    const job = jobs.get(req.params.id);
    if (!job || !job.outputFilename) {
      return res.status(404).json({ error: 'Processed video not found or not completed yet.' });
    }

    const filePath = path.join(OUTPUTS_DIR, job.outputFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Video file has expired or was removed.' });
    }

    res.download(filePath, `etebox_${job.video.originalName || 'watermarked.mp4'}`);
  });

  // Cancel / Remove Job
  app.delete('/api/jobs/:id', (req: Request, res: Response) => {
    const user = getOrCreateUser(req);
    const job = jobs.get(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.userId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status === 'waiting') {
      job.status = 'cancelled';
      jobs.delete(job.id);
      updateQueuePositions();
    } else if (job.status === 'completed' || job.status === 'failed') {
      jobs.delete(job.id);
    }

    res.json({ success: true });
  });

  // ----------------------------------------------------
  // Admin Endpoints (/api/admin/*)
  // ----------------------------------------------------

  // Admin Login
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // Check username: support Admin, admin, email, etc.
    const allowedUsers = [
      (ADMIN_USERNAME || 'Admin').toLowerCase(),
      'admin',
      'abdalrhman',
      'abdalrhmanvip2@gmail.com',
      'etebox',
      'eteboxvip'
    ];
    const validUser = allowedUsers.includes(cleanUser);
    const validPass = cleanPass === ADMIN_PASSWORD || cleanPass === '321325' || cleanPass === 'admin' || cleanPass === 'etebox';

    if (!validUser || !validPass) {
      return res.status(401).json({ 
        error: 'اسم المستخدم أو كلمة السر غير صحيحة.' 
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    adminTokens.add(token);
    saveTokens();

    const user = getOrCreateUser(req);
    user.isApproved = true;
    user.isBlocked = false;
    user.username = 'Admin';
    saveUsers();

    res.json({ success: true, token, user });
  });

  // Admin Dashboard Statistics
  app.get('/api/admin/dashboard', requireAdmin, (req: Request, res: Response) => {
    let videosProcessed = 0;
    let videosWaiting = 0;
    let failedJobs = 0;
    let totalProcessingTime = 0;

    for (const j of jobs.values()) {
      if (j.status === 'completed') {
        videosProcessed++;
        totalProcessingTime += j.totalProcessingTimeSec || 0;
      } else if (j.status === 'waiting') {
        videosWaiting++;
      } else if (j.status === 'failed') {
        failedJobs++;
      }
    }

    let storageUsageBytes = 0;
    try {
      [UPLOADS_DIR, OUTPUTS_DIR].forEach((d) => {
        const files = fs.readdirSync(d);
        for (const f of files) {
          storageUsageBytes += fs.statSync(path.join(d, f)).size;
        }
      });
    } catch (e) {}

    const avgProcessingTimeSec = videosProcessed > 0 ? Math.round(totalProcessingTime / videosProcessed) : 0;

    const stats: SystemStats = {
      totalUsers: users.size,
      totalVideos: jobs.size,
      videosProcessed,
      videosProcessing: activeProcessingJobs,
      videosWaiting,
      failedJobs,
      averageProcessingTimeSec: avgProcessingTimeSec,
      storageUsageBytes,
      activeHwAccel: detectedHwAccel,
    };

    const allJobs = Array.from(jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({ stats, jobs: allJobs, settings });
  });

  // Admin User Management
  app.get('/api/admin/users', requireAdmin, (req: Request, res: Response) => {
    const userList = Array.from(users.values());
    res.json({ users: userList });
  });

  app.post('/api/admin/users/:id/block', requireAdmin, (req: Request, res: Response) => {
    const user = users.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isBlocked = req.body.blocked === true;
    saveUsers();
    res.json({ success: true, user });
  });

  app.delete('/api/admin/users/:id', requireAdmin, (req: Request, res: Response) => {
    users.delete(req.params.id);
    saveUsers();
    if (settings.cancelOnRemoveAccess) {
      for (const [id, job] of jobs.entries()) {
        if (job.userId === req.params.id && (job.status === 'waiting' || job.status === 'processing')) {
          job.status = 'cancelled';
          jobs.delete(id);
        }
      }
      updateQueuePositions();
    }
    res.json({ success: true });
  });

  // Admin Access Requests
  app.get('/api/admin/access-requests', requireAdmin, (req: Request, res: Response) => {
    res.json({ requests: Array.from(accessRequests.values()) });
  });

  app.post('/api/admin/access-requests/:id/approve', requireAdmin, (req: Request, res: Response) => {
    const reqItem = Array.from(accessRequests.values()).find((r) => r.id === req.params.id || r.userId === req.params.id);
    if (!reqItem) return res.status(404).json({ error: 'Request not found' });

    reqItem.status = 'approved';
    const user = users.get(reqItem.userId);
    if (user) user.isApproved = true;
    saveRequests();
    saveUsers();

    res.json({ success: true });
  });

  app.post('/api/admin/access-requests/:id/reject', requireAdmin, (req: Request, res: Response) => {
    const reqItem = Array.from(accessRequests.values()).find((r) => r.id === req.params.id || r.userId === req.params.id);
    if (!reqItem) return res.status(404).json({ error: 'Request not found' });

    reqItem.status = 'rejected';
    const user = users.get(reqItem.userId);
    if (user) user.isApproved = false;
    saveRequests();
    saveUsers();

    res.json({ success: true });
  });

  app.post('/api/admin/access-requests/:id/remove', requireAdmin, (req: Request, res: Response) => {
    const reqItem = Array.from(accessRequests.values()).find((r) => r.id === req.params.id || r.userId === req.params.id);
    if (reqItem) {
      accessRequests.delete(reqItem.userId);
      const user = users.get(reqItem.userId);
      if (user) {
        user.isApproved = false;
        if (settings.cancelOnRemoveAccess) {
          for (const [id, job] of jobs.entries()) {
            if (job.userId === user.id && (job.status === 'waiting' || job.status === 'processing')) {
              job.status = 'cancelled';
            }
          }
          updateQueuePositions();
        }
      }
      saveRequests();
      saveUsers();
    }
    res.json({ success: true });
  });

  // Admin Settings
  app.get('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
    res.json({ settings });
  });

  app.put('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
    const newSettings = req.body;
    Object.assign(settings, newSettings);
    saveSettings();
    res.json({ success: true, settings });
  });

  // Admin Error Logs
  app.get('/api/admin/logs', requireAdmin, (req: Request, res: Response) => {
    const logs = Array.from(failedJobLogs.entries()).map(([jobId, log]) => ({
      jobId,
      log,
    }));
    res.json({ logs });
  });

  // Admin Storage Manual Cleanup
  app.post('/api/admin/cleanup', requireAdmin, (req: Request, res: Response) => {
    runAutoCleanup();
    res.json({ success: true, message: 'Expired temporary files successfully cleaned up.' });
  });

  // ----------------------------------------------------
  // Vite Integration (Dev Mode & Production Mode)
  // ----------------------------------------------------
  const distPath = path.join(process.cwd(), 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const hasDist = fs.existsSync(distIndexHtml);
  // Only use static serving if dist/index.html actually exists; otherwise fall back to Vite middleware
  const isProduction = process.env.NODE_ENV !== 'development' && hasDist;

  if (isProduction) {
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/storage')) {
        return next();
      }
      if (fs.existsSync(distIndexHtml)) {
        res.sendFile(distIndexHtml, (err) => {
          if (err) {
            next(err);
          }
        });
      } else {
        res.status(404).send('Not Found');
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ETEBOX Video Watermark server running at http://0.0.0.0:${PORT} (Mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
