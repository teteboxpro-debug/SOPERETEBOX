import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, Film, AlertCircle, PlayCircle, RefreshCw } from 'lucide-react';
import type { VideoMetadata } from '../types.js';
import { registerLocalVideoFile } from '../utils/clientVideoProcessor.js';

interface VideoUploadZoneProps {
  currentVideo: VideoMetadata | null;
  onVideoSelected: (video: VideoMetadata) => void;
  onClearVideo: () => void;
  isUploading: boolean;
  uploadProgress: number;
  isAuthorized?: boolean;
  onBlockedAction?: () => void;
}

export const VideoUploadZone: React.FC<VideoUploadZoneProps> = ({
  currentVideo,
  onVideoSelected,
  onClearVideo,
  isUploading,
  uploadProgress,
  isAuthorized = true,
  onBlockedAction,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatDuration = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFile = async (file: File) => {
    setErrorMessage(null);

    // Basic format check
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/i)) {
      setErrorMessage('Please select a valid video file (MP4, WebM, MOV, MKV).');
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.playsInline = true;
      tempVideo.muted = true;
      tempVideo.src = objectUrl;

      tempVideo.onloadedmetadata = () => {
        const videoMetadata: VideoMetadata = {
          id: 'local_' + Math.random().toString(36).substring(2, 10),
          filename: file.name,
          originalName: file.name,
          fileSize: file.size,
          duration: Math.round(tempVideo.duration) || 10,
          width: tempVideo.videoWidth || 1920,
          height: tempVideo.videoHeight || 1080,
          fps: 30,
          format: file.type || 'video/mp4',
          url: objectUrl,
        };

        registerLocalVideoFile(videoMetadata.id, file);
        onVideoSelected(videoMetadata);
      };

      tempVideo.onerror = () => {
        setErrorMessage('Failed to read video metadata from the selected file.');
      };
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing local video file.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isAuthorized) {
      if (onBlockedAction) onBlockedAction();
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectClick = () => {
    if (!isAuthorized) {
      if (onBlockedAction) onBlockedAction();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthorized) {
      if (onBlockedAction) onBlockedAction();
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const loadSampleVideo = async () => {
    if (!isAuthorized) {
      if (onBlockedAction) onBlockedAction();
      return;
    }
    setLoadingSample(true);
    setErrorMessage(null);
    try {
      const adminToken = localStorage.getItem('etebox_admin_token');
      const clientId = localStorage.getItem('etebox_client_id');
      const headers: Record<string, string> = {};
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      if (clientId) headers['x-client-id'] = clientId;

      const res = await fetch('/api/sample-video', { headers });
      const data = await res.json();
      if (data.success && data.video) {
        onVideoSelected(data.video);
      } else {
        setErrorMessage(data.error || 'Failed to load sample video.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading sample video.');
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.mkv,.avi"
        onChange={handleInputChange}
        className="hidden"
      />

      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {currentVideo ? (
        // Selected Video Details Card
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Film className="w-6 h-6 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-base truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                    {currentVideo.originalName || currentVideo.filename}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Original properties analyzed and preserved for rendering
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleSelectClick}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Replace Video</span>
              </button>
            </div>
          </div>

          {/* Video Metadata Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Duration
              </span>
              <span className="text-base font-bold text-slate-100 font-mono">
                {formatDuration(currentVideo.duration)}
              </span>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Resolution
              </span>
              <span className="text-base font-bold text-slate-100 font-mono">
                {currentVideo.width} × {currentVideo.height}
              </span>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                FPS
              </span>
              <span className="text-base font-bold text-slate-100 font-mono">
                {currentVideo.fps}
              </span>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Format
              </span>
              <span className="text-base font-bold text-slate-100 font-mono uppercase">
                {currentVideo.format}
              </span>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                File Size
              </span>
              <span className="text-base font-bold text-slate-100 font-mono">
                {formatFileSize(currentVideo.fileSize)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        // Dropzone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleSelectClick}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10 scale-[1.005]'
              : 'border-slate-700/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-600'
          }`}
        >
          {isUploading ? (
            <div className="py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-pulse">
                <UploadCloud className="w-7 h-7 text-amber-400 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Uploading Video...</h3>
              <p className="text-sm text-slate-400 mb-4">{uploadProgress}% uploaded</p>
              <div className="w-full max-w-xs mx-auto bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-300 h-2.5 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5">
                Upload Video to Watermark
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
                Drag and drop your MP4, MOV, or WebM video here, or tap to browse from your device.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectClick();
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Video File</span>
                </button>

                <button
                  type="button"
                  disabled={loadingSample}
                  onClick={(e) => {
                    e.stopPropagation();
                    loadSampleVideo();
                  }}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm border border-slate-700 transition-all flex items-center justify-center space-x-2"
                >
                  <PlayCircle className="w-4 h-4 text-amber-400" />
                  <span>{loadingSample ? 'Loading Demo...' : 'Try 1080p Demo Clip'}</span>
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center space-x-4 text-xs text-slate-500">
                <span>• High-Speed Encoding</span>
                <span>• Original FPS & 4K/1080p Preserved</span>
                <span>• Unaltered Audio</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
