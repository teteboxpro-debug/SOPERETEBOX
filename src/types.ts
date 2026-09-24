export type WatermarkType = 'text' | 'image' | 'both' | 'none';

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom';

export type AnimationPattern =
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'reverse-diagonal'
  | 'rectangle'
  | 'all-positions';

export type AnimationSpeed = 'slow' | 'normal' | 'fast' | 'very-fast' | 'custom';

export type WatermarkDisplayMode = 'all' | 'range' | 'interval';
export type IntervalMode = 'repeating' | 'custom';

export interface TimeInterval {
  id: string;
  startTime: number;
  endTime: number;
}

export interface WatermarkConfig {
  type: WatermarkType;
  // Text settings
  text: string;
  fontFamily: string;
  fontSizePercent: number; // 2% to 30% relative to video height (legacy/fallback)
  textSizePercent?: number; // 2% to 30% relative to video height
  textColor: string;
  textBold: boolean;
  textItalic: boolean;
  textOutline: boolean;
  outlineColor: string;
  outlineWidth?: number;
  textShadow: boolean;
  shadowColor: string;
  
  // Image settings
  logoUrl?: string;
  logoFilename?: string;
  
  // Sizing & Opacity
  sizePercent: number; // 5% to 100% relative to video dimension (legacy/fallback)
  logoSizePercent?: number; // 5% to 100% relative to video width
  opacityPercent: number; // 10% to 100%
  
  // Position
  position: WatermarkPosition;
  customXPercent: number; // 0% to 100%
  customYPercent: number; // 0% to 100%
  
  // Animation settings
  isAnimated: boolean;
  animationPattern: AnimationPattern;
  numberOfMovements: number; // 1 to 20 or custom
  numberOfRepetitions: number; // 1 to 10 or custom (0 for loop)
  animateEntireVideo: boolean;
  animationStartTime: number; // in seconds
  animationEndTime: number; // in seconds
  animationSpeed: AnimationSpeed;
  customSpeedMultiplier?: number; // 0.25x to 4x
  isDiscreteJump: boolean; // smooth vs step jumps
  
  // Overall watermark visibility timing (Display Time)
  watermarkEntireVideo: boolean;
  watermarkStartTime: number; // in seconds
  watermarkEndTime: number; // in seconds
  watermarkDuration?: number; // in seconds
  displayMode?: WatermarkDisplayMode; // 'all' | 'range' | 'interval'
  intervalType?: IntervalMode; // 'repeating' | 'custom'
  intervalDuration?: number; // in seconds (for repeating interval)
  intervalPeriod?: number; // in seconds (for repeating interval)
  customIntervals?: TimeInterval[]; // for custom intervals
  isWatermarkDeleted?: boolean; // explicitly deleted by user
  isNewlySelected?: boolean; // newly uploaded or chosen by user
}

export interface VideoMetadata {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number; // in bytes
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  format: string;
  codec?: string;
  audioCodec?: string;
  audioSampleRate?: number;
  url: string;
}

export type JobStatus = 'uploading' | 'waiting' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface QueueJob {
  id: string;
  userId: string;
  video: VideoMetadata;
  watermarkConfig: WatermarkConfig;
  status: JobStatus;
  uploadProgress: number; // 0 to 100
  processingProgress: number; // 0 to 100
  queuePosition: number;
  elapsedTimeSec: number;
  estimatedRemainingSec: number;
  totalProcessingTimeSec: number;
  outputFilename?: string;
  outputUrl?: string;
  outputSize?: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SystemSettings {
  accessMode: 'public' | 'private';
  maxVideosPerUser: number;
  maxVideoSizeMB: number;
  maxVideoDurationSec: number;
  maxConcurrentJobs: number;
  encodingPreset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast';
  hardwareAcceleration: string;
  tempFileRetentionMinutes: number;
  cancelOnRemoveAccess: boolean;
}

export interface SystemStats {
  totalUsers: number;
  totalVideos: number;
  videosProcessed: number;
  videosProcessing: number;
  videosWaiting: number;
  failedJobs: number;
  averageProcessingTimeSec: number;
  storageUsageBytes: number;
  activeHwAccel: string;
}

export interface UserRecord {
  id: string;
  ip: string;
  username: string;
  isBlocked: boolean;
  isApproved: boolean; // For private mode
  firstSeen: string;
  lastActive: string;
  totalJobs: number;
}

export interface AccessRequest {
  id: string;
  userId: string;
  username: string;
  ip: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
}
