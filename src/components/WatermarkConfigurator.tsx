import React, { useState, useRef } from 'react';
import {
  Type,
  Image as ImageIcon,
  Sparkles,
  Move,
  Clock,
  Sliders,
  Upload,
  Layers,
  Zap,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Repeat,
  Calendar,
  Eye,
  Percent,
  Timer,
  CheckCircle2,
} from 'lucide-react';
import type {
  WatermarkConfig,
  WatermarkType,
  WatermarkPosition,
  AnimationPattern,
  AnimationSpeed,
  VideoMetadata,
  TimeInterval,
  WatermarkDisplayMode,
  IntervalMode
} from '../types.js';

interface WatermarkConfiguratorProps {
  config: WatermarkConfig;
  onChange: (newConfig: WatermarkConfig) => void;
  video: VideoMetadata | null;
  onDeleteWatermark?: () => void;
}

export const WatermarkConfigurator: React.FC<WatermarkConfiguratorProps> = ({
  config,
  onChange,
  video,
  onDeleteWatermark,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'position' | 'animation' | 'timing'>('content');

  const videoDuration = video?.duration || 60;
  const videoWidth = video?.width || 1920;
  const videoHeight = video?.height || 1080;

  const currentLogoSize = config.logoSizePercent ?? config.sizePercent ?? 25;
  const currentTextSize = config.textSizePercent ?? config.fontSizePercent ?? 8;
  const currentDuration = config.watermarkDuration ?? Math.max(1, (config.watermarkEndTime || videoDuration) - (config.watermarkStartTime || 0));

  const update = (partial: Partial<WatermarkConfig>) => {
    onChange({ ...config, ...partial });
  };

  const handleDeleteWatermark = () => {
    if (onDeleteWatermark) {
      onDeleteWatermark();
    } else {
      update({
        type: 'none',
        text: '',
        logoUrl: undefined,
        logoFilename: undefined,
        isWatermarkDeleted: true,
        isNewlySelected: false,
        isAnimated: false,
      });
    }
  };

  const handleDeleteLogo = () => {
    if (config.type === 'both' && config.text && config.text.trim()) {
      update({
        type: 'text',
        logoUrl: undefined,
        logoFilename: undefined,
        isWatermarkDeleted: false,
      });
    } else {
      handleDeleteWatermark();
    }
  };

  const handleClearText = () => {
    if (config.type === 'both' && config.logoUrl) {
      update({
        type: 'image',
        text: '',
        isWatermarkDeleted: false,
      });
    } else {
      handleDeleteWatermark();
    }
  };

  const setLogoSize = (val: number) => {
    const clamped = Math.max(5, Math.min(100, Math.round(val)));
    update({ logoSizePercent: clamped, sizePercent: clamped });
  };

  const setTextSize = (val: number) => {
    const clamped = Math.max(2, Math.min(35, Math.round(val)));
    update({ textSizePercent: clamped, fontSizePercent: clamped });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingLogo(true);
    setLogoError(null);

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.logo) {
        update({
          type: config.type === 'both' ? 'both' : 'image',
          logoUrl: data.logo.url,
          logoFilename: data.logo.filename,
          isNewlySelected: true,
          isWatermarkDeleted: false,
        });
      } else {
        setLogoError(data.error || 'Failed to upload logo');
      }
    } catch (err: any) {
      setLogoError(err.message || 'Error uploading logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const logoSizePresets = [10, 15, 20, 25, 30, 40, 50, 75, 100];
  const textSizePresets = [3, 5, 7, 8, 10, 12, 15, 20, 25];
  const sizePresets = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const opacityPresets = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const movementPresets = [1, 2, 3, 4, 5, 10, 20];
  const colorPresets = ['#ffffff', '#ffd700', '#00e5ff', '#10b981', '#ec4899', '#ef4444', '#000000'];

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
      {/* Configuration Header Navigation & Delete Action */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950/70 p-2 gap-2">
        <div className="flex border border-slate-800 rounded-xl bg-slate-900/80 p-0.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-2 px-3 sm:px-4 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all ${
              activeTab === 'content'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Content</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('position')}
            className={`py-2 px-3 sm:px-4 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all ${
              activeTab === 'position'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Move className="w-4 h-4" />
            <span>Position & Size</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('animation')}
            className={`py-2 px-3 sm:px-4 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all ${
              activeTab === 'animation'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Animation</span>
            {config.isAnimated && config.position !== 'center' && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timing')}
            className={`py-2 px-3 sm:px-4 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all ${
              activeTab === 'timing'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Display Time</span>
            {(!config.watermarkEntireVideo || config.displayMode === 'range' || config.displayMode === 'interval') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Clearly Visible & Accessible Delete Watermark Button */}
        <button
          type="button"
          onClick={handleDeleteWatermark}
          className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 ml-auto"
          title="Completely remove any watermark from this video"
        >
          <Trash2 className="w-4 h-4 text-rose-400 group-hover:text-white" />
          <span>Delete Watermark / حذف العلامة</span>
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: WATERMARK CONTENT (Text / Image / Both)                            */}
        {/* ========================================================================= */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Type Switcher */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Watermark Type
                </label>
                {config.type === 'none' && (
                  <span className="text-xs text-rose-400 font-semibold flex items-center space-x-1">
                    <span>(Watermark is Deleted)</span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => update({ type: 'text', isNewlySelected: true, isWatermarkDeleted: false })}
                  className={`py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    config.type === 'text'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Type className="w-5 h-5" />
                  <span>1. Text</span>
                </button>

                <button
                  type="button"
                  onClick={() => update({ type: 'image', isNewlySelected: true, isWatermarkDeleted: false })}
                  className={`py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    config.type === 'image'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span>2. Image / Logo</span>
                </button>

                <button
                  type="button"
                  onClick={() => update({ type: 'both', isNewlySelected: true, isWatermarkDeleted: false })}
                  className={`py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center space-y-1.5 transition-all ${
                    config.type === 'both'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                  <span>3. Text + Logo</span>
                </button>
              </div>
            </div>

            {/* Status when Watermark is completely Deleted or None */}
            {config.type === 'none' && !config.logoUrl && !config.text && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-slate-300 block flex items-center justify-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>No Watermark Active (Clean Video)</span>
                </span>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  The watermark was removed. Your video will be exported without any watermark. Click Text or Image above if you wish to configure a new watermark.
                </p>
              </div>
            )}

            {/* TEXT CONFIGURATION */}
            {(config.type === 'text' || config.type === 'both') && (
              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Watermark Text
                    </label>
                    {config.text && config.text.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearText}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center space-x-1 font-semibold"
                        title="Clear watermark text"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Text</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={config.text}
                    onChange={(e) => update({ text: e.target.value, isNewlySelected: true, isWatermarkDeleted: false })}
                    placeholder="e.g. Type your watermark text"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm"
                  />
                </div>

                {/* Font Family & Text Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Font Family
                    </label>
                    <select
                      value={config.fontFamily}
                      onChange={(e) => update({ fontFamily: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                    >
                      <option value="sans-serif">Sans-Serif (Liberation Sans)</option>
                      <option value="Impact">Impact (Heavy Bold)</option>
                      <option value="monospace">Monospace (Terminal)</option>
                      <option value="serif">Serif (Formal Classic)</option>
                    </select>
                  </div>

                  {/* Text Size Control */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">
                        Text Size (Relative to Video Height)
                      </label>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setTextSize(currentTextSize - 1)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700"
                          title="Decrease text size by 1%"
                        >
                          -1%
                        </button>
                        <span className="text-amber-400 font-mono font-bold text-xs min-w-[32px] text-center">
                          {currentTextSize}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setTextSize(currentTextSize + 1)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700"
                          title="Increase text size by 1%"
                        >
                          +1%
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      step="0.5"
                      value={currentTextSize}
                      onChange={(e) => setTextSize(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                      <span>2% (Compact)</span>
                      <span className="text-slate-400 font-sans">≈ {Math.round(videoHeight * (currentTextSize / 100))}px</span>
                      <span>30% (Prominent)</span>
                    </div>
                  </div>
                </div>

                {/* Text Size Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400 block">Text Size Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {textSizePresets.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTextSize(pct)}
                        className={`py-1 px-2.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                          currentTextSize === pct
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Color & Styling Toggles */}
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-300">
                    Text Color & Preset Palette
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={config.textColor}
                      onChange={(e) => update({ textColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <div className="flex items-center space-x-2">
                      {colorPresets.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => update({ textColor: c })}
                          style={{ backgroundColor: c }}
                          className={`w-7 h-7 rounded-full border border-slate-600 transition-transform ${
                            config.textColor.toLowerCase() === c ? 'scale-125 ring-2 ring-amber-400' : 'hover:scale-110'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bold / Italic / Outline / Shadow */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => update({ textBold: !config.textBold })}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        config.textBold
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      B • Bold
                    </button>

                    <button
                      type="button"
                      onClick={() => update({ textItalic: !config.textItalic })}
                      className={`py-2 px-3 rounded-lg border text-xs italic font-medium transition-all ${
                        config.textItalic
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      I • Italic
                    </button>

                    <button
                      type="button"
                      onClick={() => update({ textOutline: !config.textOutline })}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        config.textOutline
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      Outline Stroke
                    </button>

                    <button
                      type="button"
                      onClick={() => update({ textShadow: !config.textShadow })}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        config.textShadow
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      Drop Shadow
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* LOGO CONFIGURATION */}
            {(config.type === 'image' || config.type === 'both') && (
              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Logo / Image (PNG, JPG, WEBP • Transparency Supported)
                </label>

                {config.logoUrl ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center overflow-hidden">
                        <img
                          src={config.logoUrl}
                          alt="Watermark Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">
                          {config.logoFilename || 'Uploaded Logo'}
                        </span>
                        <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Active on video</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteLogo}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-semibold border border-rose-500/30 transition-all flex items-center space-x-1"
                        title="Delete logo from video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Logo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 text-center space-y-3">
                    <p className="text-xs text-slate-400">
                      Upload your logo watermark (PNG with transparency recommended). Only logos you upload will appear.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo (PNG/JPG)'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Logo Size Control inside Logo Tab */}
                <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300">
                        Logo Watermark Size
                      </label>
                      <span className="text-[11px] text-slate-400">
                        ≈ {Math.round(videoWidth * (currentLogoSize / 100))} px width on {videoWidth}×{videoHeight}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setLogoSize(currentLogoSize - 5)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700"
                        title="Decrease logo size by 5%"
                      >
                        -5%
                      </button>
                      <span className="text-sm font-bold font-mono text-amber-400 px-1 min-w-[36px] text-center">
                        {currentLogoSize}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setLogoSize(currentLogoSize + 5)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700"
                        title="Increase logo size by 5%"
                      >
                        +5%
                      </button>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {logoSizePresets.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setLogoSize(pct)}
                        className={`py-1 px-2.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                          currentLogoSize === pct
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="1"
                    value={currentLogoSize}
                    onChange={(e) => setLogoSize(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-400 cursor-pointer pt-1"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>5% (Subtle corner)</span>
                    <span className="text-slate-400 font-sans">Scaled automatically to original resolution</span>
                    <span>100% (Full screen)</span>
                  </div>
                </div>

                {logoError && <p className="text-xs text-rose-400">{logoError}</p>}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: POSITION, SIZE & OPACITY                                           */}
        {/* ========================================================================= */}
        {activeTab === 'position' && (
          <div className="space-y-6">
            {/* 1. Dedicated Logo Size Control (When watermark includes Logo) */}
            {(config.type === 'image' || config.type === 'both') && (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                      <span>Logo Size Control</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Relative to video width ({videoWidth}px) • ≈ {Math.round(videoWidth * (currentLogoSize / 100))} px
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setLogoSize(currentLogoSize - 5)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95"
                      title="Decrease logo size by 5%"
                    >
                      -5%
                    </button>
                    <span className="text-base font-bold font-mono text-amber-400 px-2 min-w-[44px] text-center bg-slate-900 py-1 rounded-lg border border-slate-800">
                      {currentLogoSize}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setLogoSize(currentLogoSize + 5)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95"
                      title="Increase logo size by 5%"
                    >
                      +5%
                    </button>
                  </div>
                </div>

                {/* Logo Size Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {logoSizePresets.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setLogoSize(pct)}
                      className={`py-1 px-2.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                        currentLogoSize === pct
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={currentLogoSize}
                  onChange={(e) => setLogoSize(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer pt-1"
                />
              </div>
            )}

            {/* 2. Dedicated Text Size Control (When watermark includes Text) */}
            {(config.type === 'text' || config.type === 'both') && (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Type className="w-4 h-4 text-amber-400" />
                      <span>Text Size Control</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Relative to video height ({videoHeight}p) • ≈ {Math.round(videoHeight * (currentTextSize / 100))} px font
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setTextSize(currentTextSize - 1)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95"
                      title="Decrease text size by 1%"
                    >
                      -1%
                    </button>
                    <span className="text-base font-bold font-mono text-amber-400 px-2 min-w-[44px] text-center bg-slate-900 py-1 rounded-lg border border-slate-800">
                      {currentTextSize}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setTextSize(currentTextSize + 1)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 active:scale-95"
                      title="Increase text size by 1%"
                    >
                      +1%
                    </button>
                  </div>
                </div>

                {/* Text Size Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {textSizePresets.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTextSize(pct)}
                      className={`py-1 px-2.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                        currentTextSize === pct
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="0.5"
                  value={currentTextSize}
                  onChange={(e) => setTextSize(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer pt-1"
                />
              </div>
            )}

            {/* Watermark Opacity */}
            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Watermark Opacity
                </label>
                <span className="text-sm font-bold font-mono text-amber-400">
                  {config.opacityPercent}%
                </span>
              </div>

              {/* Presets 10% to 100% */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {opacityPresets.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => update({ opacityPercent: pct })}
                    className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                      config.opacityPercent === pct
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Slider */}
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={config.opacityPercent}
                onChange={(e) => update({ opacityPercent: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-400 cursor-pointer pt-1"
              />
            </div>

            {/* Position 3x3 Grid & Custom Coordinate */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Watermark Position (مكان وظهور الشعار)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    اختر المكان المناسب أو انقر "Center / منتصف الشاشة"
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-amber-400 font-mono font-semibold uppercase block">
                    {config.position}
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans">
                    {config.isAnimated ? '⚡ متحرك (Animated)' : '✓ ثابت (Fixed)'}
                  </span>
                </div>
              </div>

              {/* Status Notice if animation was previously active or center selected */}
              {config.position === 'center' && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    تم ضبط الشعار في <strong>منتصف الشاشة تماماً (Exact Center)</strong>، وتم تثبيته وإيقاف الحركة التلقائية لضمان ثباته بالمنتصف.
                  </span>
                </div>
              )}

              {/* 3x3 Position Grid UI */}
              <div className="max-w-xs mx-auto p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="grid grid-cols-3 gap-2">
                  {/* Row 1: Top */}
                  <button
                    type="button"
                    onClick={() => update({ position: 'top-left', customXPercent: 5, customYPercent: 5, isAnimated: false })}
                    title="Top Left"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'top-left'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>↖</span>
                    <span className="text-[9px]">Top Left</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => update({ position: 'top-center', customXPercent: 50, customYPercent: 5, isAnimated: false })}
                    title="Top Center"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'top-center'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>↑</span>
                    <span className="text-[9px]">Top Ctr</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => update({ position: 'top-right', customXPercent: 95, customYPercent: 5, isAnimated: false })}
                    title="Top Right"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'top-right'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>↗</span>
                    <span className="text-[9px]">Top Right</span>
                  </button>

                  {/* Row 2: Middle */}
                  <button
                    type="button"
                    onClick={() => update({ position: 'middle-left', customXPercent: 5, customYPercent: 50, isAnimated: false })}
                    title="Middle Left"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'middle-left'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>←</span>
                    <span className="text-[9px]">Mid Left</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => update({ position: 'center', customXPercent: 50, customYPercent: 50, isAnimated: false })}
                    title="Center (منتصف الشاشة)"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'center'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>●</span>
                    <span className="text-[9px] font-extrabold">Center / المنتصف</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => update({ position: 'middle-right', customXPercent: 95, customYPercent: 50, isAnimated: false })}
                    title="Middle Right"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'middle-right'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>→</span>
                    <span className="text-[9px]">Mid Right</span>
                  </button>

                  {/* Row 3: Bottom */}
                  <button
                    type="button"
                    onClick={() => update({ position: 'bottom-left', customXPercent: 5, customYPercent: 95, isAnimated: false })}
                    title="Bottom Left"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'bottom-left'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>↙</span>
                    <span className="text-[9px]">Btm Left</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => update({ position: 'bottom-center', customXPercent: 50, customYPercent: 95, isAnimated: false })}
                    title="Bottom Center"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'bottom-center'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>↓</span>
                    <span className="text-[9px]">Btm Ctr</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => update({ position: 'bottom-right', customXPercent: 95, customYPercent: 95, isAnimated: false })}
                    title="Bottom Right"
                    className={`h-12 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                      config.position === 'bottom-right'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>↘</span>
                    <span className="text-[9px]">Btm Right</span>
                  </button>
                </div>
              </div>

              {/* Custom Relative Coordinates */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block">
                      Custom Coordinate Positioning
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Set custom X and Y percentages or drag directly on the video
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => update({ position: 'custom', isAnimated: false })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      config.position === 'custom'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {config.position === 'custom' ? 'Custom Active' : 'Enable Custom X/Y'}
                  </button>
                </div>

                {/* Quick Presets for Custom Coordinates */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 self-center mr-1">Quick Presets:</span>
                  {[
                    { label: 'Middle / Center (المنتصف)', x: 50, y: 50 },
                    { label: 'Lower Middle', x: 50, y: 66 },
                    { label: 'Upper Middle', x: 50, y: 33 },
                    { label: 'Top Center', x: 50, y: 5 },
                    { label: 'Bottom Center', x: 50, y: 92 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        update({
                          position: 'custom',
                          customXPercent: preset.x,
                          customYPercent: preset.y,
                          isAnimated: false,
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        config.position === 'custom' &&
                        config.customXPercent === preset.x &&
                        config.customYPercent === preset.y
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>X Position (Horizontal)</span>
                      <span className="font-mono text-amber-400">{config.customXPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.customXPercent}
                      onChange={(e) =>
                        update({
                          position: 'custom',
                          customXPercent: parseInt(e.target.value, 10),
                          isAnimated: false,
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Y Position (Vertical)</span>
                      <span className="font-mono text-amber-400">{config.customYPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.customYPercent}
                      onChange={(e) =>
                        update({
                          position: 'custom',
                          customYPercent: parseInt(e.target.value, 10),
                          isAnimated: false,
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Status Notice */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    Fixed Placement Active: The watermark will render at this exact location in the middle/selected spot when saved and played.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ANIMATED WATERMARK                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'animation' && (
          <div className="space-y-6">
            {/* Main Animation Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    config.isAnimated
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">
                    Animated Watermark Movement
                  </span>
                  <span className="text-xs text-slate-400">
                    Moves the watermark across video frames to prevent removal
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => update({ isAnimated: !config.isAnimated })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  config.isAnimated ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.isAnimated ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {config.isAnimated ? (
              <div className="space-y-5 pt-2">
                {/* 1. Animation Path / Pattern */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                    Movement Pattern
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'horizontal', label: '1. Horizontal', desc: 'Left → Right' },
                      { id: 'vertical', label: '2. Vertical', desc: 'Top → Bottom' },
                      { id: 'diagonal', label: '3. Diagonal', desc: 'Top Left → Bottom Right' },
                      { id: 'reverse-diagonal', label: '4. Rev. Diagonal', desc: 'Top Right → Bottom Left' },
                      { id: 'rectangle', label: '5. Rectangle', desc: 'Perimeter Loop (4 Corners)' },
                      { id: 'all-positions', label: '6. All Positions', desc: 'Cycles 9 Screen Areas' },
                    ].map((pat) => (
                      <button
                        key={pat.id}
                        type="button"
                        onClick={() => update({ animationPattern: pat.id as AnimationPattern })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          config.animationPattern === pat.id
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold block text-white">{pat.label}</span>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">{pat.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Number of Movements & Number of Repetitions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Number of Movements */}
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      Number of Movements
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {movementPresets.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => update({ numberOfMovements: m })}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${
                            config.numberOfMovements === m
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-xs text-slate-400">Custom:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={config.numberOfMovements}
                        onChange={(e) =>
                          update({ numberOfMovements: Math.max(1, parseInt(e.target.value, 10) || 1) })
                        }
                        className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Number of Repetitions */}
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      Number of Repetitions
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 5, 10].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => update({ numberOfRepetitions: r })}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${
                            config.numberOfRepetitions === r
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-xs text-slate-400">Custom Reps:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={config.numberOfRepetitions}
                        onChange={(e) =>
                          update({
                            numberOfRepetitions: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Animation Speed & Motion Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Animation Speed
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['slow', 'normal', 'fast', 'very-fast'] as AnimationSpeed[]).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => update({ animationSpeed: spd })}
                          className={`py-2 text-xs font-semibold rounded-lg border capitalize ${
                            config.animationSpeed === spd
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {spd.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Motion Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => update({ isDiscreteJump: false })}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                          !config.isDiscreteJump
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        Smooth Glide
                      </button>
                      <button
                        type="button"
                        onClick={() => update({ isDiscreteJump: true })}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                          config.isDiscreteJump
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        Discrete Steps
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Animation Active Duration Window */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Animation Active Timeline
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => update({ animateEntireVideo: true })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          config.animateEntireVideo
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Entire Video
                      </button>
                      <button
                        type="button"
                        onClick={() => update({ animateEntireVideo: false })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          !config.animateEntireVideo
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Custom Time
                      </button>
                    </div>
                  </div>

                  {!config.animateEntireVideo && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">
                          Start Animation (MM:SS)
                        </span>
                        <input
                          type="text"
                          value={formatSeconds(config.animationStartTime)}
                          onChange={(e) =>
                            update({
                              animationStartTime: Math.min(
                                config.animationEndTime - 1,
                                parseTime(e.target.value)
                              ),
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">
                          End Animation (MM:SS)
                        </span>
                        <input
                          type="text"
                          value={formatSeconds(config.animationEndTime || videoDuration)}
                          onChange={(e) =>
                            update({
                              animationEndTime: Math.min(
                                videoDuration,
                                Math.max(config.animationStartTime + 1, parseTime(e.target.value))
                              ),
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-200">
                  Fixed Static Position Mode Active
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Your watermark will remain fixed in place at your selected location (such as Middle / Center). It will not drift or jump to the top when saved and played. To make it travel across the screen over time, turn ON the toggle above.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: WATERMARK DISPLAY TIME & INTERVALS                                 */}
        {/* ========================================================================= */}
        {activeTab === 'timing' && (
          <div className="space-y-6">
            {/* Display Mode Selection */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-white block flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Watermark Display Time & Visibility Schedule</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    Control exactly when the watermark appears and disappears in the final video
                  </span>
                </div>

                <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        displayMode: 'all',
                        watermarkEntireVideo: true,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      config.watermarkEntireVideo || config.displayMode === 'all'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Entire Video
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const startTime = config.watermarkStartTime || 0;
                      const duration = config.watermarkDuration || 10;
                      const endTime = Math.min(videoDuration, startTime + duration);
                      update({
                        displayMode: 'range',
                        watermarkEntireVideo: false,
                        watermarkStartTime: startTime,
                        watermarkEndTime: endTime,
                        watermarkDuration: Math.max(1, endTime - startTime),
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !config.watermarkEntireVideo && config.displayMode === 'range'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Specific Window
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      update({
                        displayMode: 'interval',
                        watermarkEntireVideo: false,
                        intervalType: config.intervalType || 'repeating',
                        intervalDuration: config.intervalDuration || 5,
                        intervalPeriod: config.intervalPeriod || 20,
                        customIntervals:
                          config.customIntervals && config.customIntervals.length > 0
                            ? config.customIntervals
                            : [
                                { id: 'int-1', startTime: 2, endTime: 7 },
                                { id: 'int-2', startTime: Math.max(10, Math.floor(videoDuration * 0.5)), endTime: Math.max(15, Math.floor(videoDuration * 0.5) + 5) },
                              ],
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !config.watermarkEntireVideo && config.displayMode === 'interval'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Selected Intervals
                  </button>
                </div>
              </div>

              {/* MODE 1: ENTIRE VIDEO */}
              {(config.watermarkEntireVideo || config.displayMode === 'all') && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-white block">Continuous Watermark</span>
                      <span className="text-slate-400">
                        Visible for the entire duration (00:00 → {formatSeconds(videoDuration)})
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                    100% of Video
                  </span>
                </div>
              )}

              {/* MODE 2: SPECIFIC TIME WINDOW (Start, End & Duration) */}
              {!config.watermarkEntireVideo && config.displayMode === 'range' && (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  {/* Start, End and Linked Duration inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Start Time */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-300">Start Time (MM:SS)</span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          {config.watermarkStartTime}s
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formatSeconds(config.watermarkStartTime)}
                        onChange={(e) => {
                          const parsed = Math.max(0, Math.min(videoDuration - 1, parseTime(e.target.value)));
                          const currentDur = config.watermarkDuration || 5;
                          const newEnd = Math.min(videoDuration, parsed + currentDur);
                          update({
                            watermarkStartTime: parsed,
                            watermarkEndTime: newEnd,
                            watermarkDuration: Math.max(1, newEnd - parsed),
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold"
                      />
                      <div className="flex items-center space-x-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newStart = Math.max(0, config.watermarkStartTime - 5);
                            const dur = config.watermarkDuration || 5;
                            update({
                              watermarkStartTime: newStart,
                              watermarkEndTime: Math.min(videoDuration, newStart + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          -5s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newStart = Math.max(0, config.watermarkStartTime - 1);
                            const dur = config.watermarkDuration || 5;
                            update({
                              watermarkStartTime: newStart,
                              watermarkEndTime: Math.min(videoDuration, newStart + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          -1s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newStart = Math.min(videoDuration - 1, config.watermarkStartTime + 1);
                            const dur = config.watermarkDuration || 5;
                            update({
                              watermarkStartTime: newStart,
                              watermarkEndTime: Math.min(videoDuration, newStart + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          +1s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newStart = Math.min(videoDuration - 5, config.watermarkStartTime + 5);
                            const dur = config.watermarkDuration || 5;
                            update({
                              watermarkStartTime: newStart,
                              watermarkEndTime: Math.min(videoDuration, newStart + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          +5s
                        </button>
                      </div>
                    </div>

                    {/* Specific Duration Control */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-amber-300 flex items-center space-x-1">
                          <Timer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Display Duration</span>
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          {currentDuration}s
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max={videoDuration}
                          value={currentDuration}
                          onChange={(e) => {
                            const dur = Math.max(1, Math.min(videoDuration, parseInt(e.target.value, 10) || 1));
                            const newEnd = Math.min(videoDuration, config.watermarkStartTime + dur);
                            update({
                              watermarkDuration: dur,
                              watermarkEndTime: newEnd,
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-mono text-sm font-bold"
                        />
                        <span className="text-xs text-slate-400 font-mono">sec</span>
                      </div>
                      <div className="flex items-center space-x-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const dur = Math.max(1, currentDuration - 5);
                            update({
                              watermarkDuration: dur,
                              watermarkEndTime: Math.min(videoDuration, config.watermarkStartTime + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          -5s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const dur = Math.max(1, currentDuration - 1);
                            update({
                              watermarkDuration: dur,
                              watermarkEndTime: Math.min(videoDuration, config.watermarkStartTime + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          -1s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const dur = Math.min(videoDuration, currentDuration + 1);
                            update({
                              watermarkDuration: dur,
                              watermarkEndTime: Math.min(videoDuration, config.watermarkStartTime + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          +1s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const dur = Math.min(videoDuration, currentDuration + 5);
                            update({
                              watermarkDuration: dur,
                              watermarkEndTime: Math.min(videoDuration, config.watermarkStartTime + dur),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          +5s
                        </button>
                      </div>
                    </div>

                    {/* End Time */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-300">End Time (MM:SS)</span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          {config.watermarkEndTime || videoDuration}s
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formatSeconds(config.watermarkEndTime || videoDuration)}
                        onChange={(e) => {
                          const parsed = Math.min(videoDuration, Math.max(config.watermarkStartTime + 1, parseTime(e.target.value)));
                          update({
                            watermarkEndTime: parsed,
                            watermarkDuration: Math.max(1, parsed - config.watermarkStartTime),
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold"
                      />
                      <div className="flex items-center space-x-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const currentEnd = config.watermarkEndTime || videoDuration;
                            const newEnd = Math.max(config.watermarkStartTime + 1, currentEnd - 5);
                            update({
                              watermarkEndTime: newEnd,
                              watermarkDuration: Math.max(1, newEnd - config.watermarkStartTime),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          -5s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentEnd = config.watermarkEndTime || videoDuration;
                            const newEnd = Math.max(config.watermarkStartTime + 1, currentEnd - 1);
                            update({
                              watermarkEndTime: newEnd,
                              watermarkDuration: Math.max(1, newEnd - config.watermarkStartTime),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          -1s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentEnd = config.watermarkEndTime || videoDuration;
                            const newEnd = Math.min(videoDuration, currentEnd + 1);
                            update({
                              watermarkEndTime: newEnd,
                              watermarkDuration: Math.max(1, newEnd - config.watermarkStartTime),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          +1s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentEnd = config.watermarkEndTime || videoDuration;
                            const newEnd = Math.min(videoDuration, currentEnd + 5);
                            update({
                              watermarkEndTime: newEnd,
                              watermarkDuration: Math.max(1, newEnd - config.watermarkStartTime),
                            });
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold"
                        >
                          +5s
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Timing Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400 block font-medium">
                      Quick Window Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'First 5s', start: 0, end: Math.min(5, videoDuration) },
                        { label: 'First 10s', start: 0, end: Math.min(10, videoDuration) },
                        { label: 'First 30s', start: 0, end: Math.min(30, videoDuration) },
                        {
                          label: 'Middle Half (50%)',
                          start: Math.floor(videoDuration * 0.25),
                          end: Math.floor(videoDuration * 0.75),
                        },
                        {
                          label: 'Last 10s',
                          start: Math.max(0, videoDuration - 10),
                          end: videoDuration,
                        },
                        {
                          label: 'Last 5s',
                          start: Math.max(0, videoDuration - 5),
                          end: videoDuration,
                        },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            update({
                              watermarkStartTime: preset.start,
                              watermarkEndTime: preset.end,
                              watermarkDuration: Math.max(1, preset.end - preset.start),
                            })
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: SELECTED TIME INTERVALS (Periodic Repeating vs Custom Multi-Intervals) */}
              {!config.watermarkEntireVideo && config.displayMode === 'interval' && (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-300">Interval Mode:</span>
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => update({ intervalType: 'repeating' })}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
                          config.intervalType === 'repeating'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                        <span>Periodic Repeating</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => update({ intervalType: 'custom' })}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
                          config.intervalType === 'custom'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Custom Multi-Intervals</span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-mode A: Periodic Repeating */}
                  {config.intervalType === 'repeating' && (
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Visible Duration */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-slate-300">
                              Watermark Visible For:
                            </label>
                            <span className="text-xs font-mono font-bold text-amber-400">
                              {config.intervalDuration || 5} seconds
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="30"
                            step="1"
                            value={config.intervalDuration || 5}
                            onChange={(e) => {
                              const dur = parseInt(e.target.value, 10);
                              update({
                                intervalDuration: dur,
                                intervalPeriod: Math.max(dur + 2, config.intervalPeriod || 20),
                              });
                            }}
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                          <div className="flex gap-1.5">
                            {[3, 5, 8, 10, 15].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() =>
                                  update({
                                    intervalDuration: d,
                                    intervalPeriod: Math.max(d + 2, config.intervalPeriod || 20),
                                  })
                                }
                                className={`px-2 py-0.5 text-xs font-mono rounded ${
                                  config.intervalDuration === d
                                    ? 'bg-amber-500 text-slate-950 font-bold'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {d}s
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Repeating Cycle Period */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-slate-300">
                              Repeat Cycle Period:
                            </label>
                            <span className="text-xs font-mono font-bold text-amber-400">
                              Every {config.intervalPeriod || 20} seconds
                            </span>
                          </div>
                          <input
                            type="range"
                            min={Math.max(5, (config.intervalDuration || 5) + 2)}
                            max="120"
                            step="5"
                            value={config.intervalPeriod || 20}
                            onChange={(e) =>
                              update({ intervalPeriod: parseInt(e.target.value, 10) })
                            }
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                          <div className="flex gap-1.5">
                            {[15, 20, 30, 45, 60].map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => update({ intervalPeriod: p })}
                                className={`px-2 py-0.5 text-xs font-mono rounded ${
                                  config.intervalPeriod === p
                                    ? 'bg-amber-500 text-slate-950 font-bold'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {p}s
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Human Summary Card */}
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center space-x-2">
                        <Repeat className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>
                          The watermark appears for{' '}
                          <strong>{config.intervalDuration || 5}s</strong>, stays hidden for{' '}
                          <strong>
                            {(config.intervalPeriod || 20) - (config.intervalDuration || 5)}s
                          </strong>
                          , and repeats cyclically every{' '}
                          <strong>{config.intervalPeriod || 20}s</strong> throughout the video.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sub-mode B: Custom Multi-Intervals */}
                  {config.intervalType === 'custom' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          Configured Intervals ({config.customIntervals?.length || 0})
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              const intervals = config.customIntervals || [];
                              const lastEnd =
                                intervals.length > 0
                                  ? intervals[intervals.length - 1].endTime
                                  : 0;
                              const newStart = Math.min(videoDuration - 2, lastEnd + 5);
                              const newEnd = Math.min(videoDuration, newStart + 5);
                              update({
                                customIntervals: [
                                  ...intervals,
                                  {
                                    id: `int-${Date.now()}`,
                                    startTime: newStart,
                                    endTime: newEnd,
                                  },
                                ],
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Interval</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(config.customIntervals || []).map((interval, idx) => {
                          const dur = Math.max(0, interval.endTime - interval.startTime);
                          return (
                            <div
                              key={interval.id}
                              className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center gap-3"
                            >
                              <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] text-slate-400">From:</span>
                                <input
                                  type="text"
                                  value={formatSeconds(interval.startTime)}
                                  onChange={(e) => {
                                    const parsed = Math.max(0, parseTime(e.target.value));
                                    update({
                                      customIntervals: (config.customIntervals || []).map((item) =>
                                        item.id === interval.id
                                          ? { ...item, startTime: parsed, endTime: Math.max(parsed + 1, item.endTime) }
                                          : item
                                      ),
                                    });
                                  }}
                                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs font-bold text-center"
                                />
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] text-slate-400">To:</span>
                                <input
                                  type="text"
                                  value={formatSeconds(interval.endTime)}
                                  onChange={(e) => {
                                    const parsed = Math.min(videoDuration, parseTime(e.target.value));
                                    update({
                                      customIntervals: (config.customIntervals || []).map((item) =>
                                        item.id === interval.id
                                          ? { ...item, endTime: Math.max(item.startTime + 1, parsed) }
                                          : item
                                      ),
                                    });
                                  }}
                                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs font-bold text-center"
                                />
                              </div>

                              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 text-[11px] font-mono font-bold">
                                {dur.toFixed(1)}s
                              </span>

                              <div className="ml-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    update({
                                      customIntervals: (config.customIntervals || []).filter(
                                        (item) => item.id !== interval.id
                                      ),
                                    });
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  title="Remove this interval"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {(!config.customIntervals || config.customIntervals.length === 0) && (
                          <div className="p-4 text-center text-xs text-slate-500 rounded-xl bg-slate-900/40 border border-dashed border-slate-800">
                            No custom intervals defined. Click "+ Add Interval" to create one.
                          </div>
                        )}
                      </div>

                      {/* Templates */}
                      <div className="flex items-center space-x-2 pt-1">
                        <span className="text-[11px] text-slate-400">Templates:</span>
                        <button
                          type="button"
                          onClick={() => {
                            update({
                              customIntervals: [
                                { id: 'intro', startTime: 0, endTime: Math.min(5, videoDuration) },
                                { id: 'outro', startTime: Math.max(0, videoDuration - 5), endTime: videoDuration },
                              ],
                            });
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700"
                        >
                          Intro & Outro (First & Last 5s)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const p1 = Math.floor(videoDuration * 0.25);
                            const p2 = Math.floor(videoDuration * 0.5);
                            const p3 = Math.floor(videoDuration * 0.75);
                            update({
                              customIntervals: [
                                { id: 'int-1', startTime: p1, endTime: Math.min(videoDuration, p1 + 5) },
                                { id: 'int-2', startTime: p2, endTime: Math.min(videoDuration, p2 + 5) },
                                { id: 'int-3', startTime: p3, endTime: Math.min(videoDuration, p3 + 5) },
                              ],
                            });
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700"
                        >
                          3 Flash Segments (25%, 50%, 75%)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VISUAL DISPLAY TIMELINE TRACK */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Visibility Timeline Visualizer</span>
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {formatSeconds(0)} → {formatSeconds(videoDuration)}
                  </span>
                </div>

                {/* Timeline Bar */}
                <div className="relative h-6 w-full rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center p-0.5">
                  {/* Background Track */}
                  {config.watermarkEntireVideo || config.displayMode === 'all' ? (
                    <div className="h-full w-full rounded-lg bg-amber-500/80 flex items-center justify-center text-[10px] font-mono font-bold text-slate-950">
                      Watermark Visible Throughout Video
                    </div>
                  ) : config.displayMode === 'range' ? (
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-lg bg-amber-500 flex items-center justify-center text-[10px] font-mono font-bold text-slate-950 transition-all shadow"
                      style={{
                        left: `${((config.watermarkStartTime || 0) / videoDuration) * 100}%`,
                        width: `${Math.max(
                          2,
                          (((config.watermarkEndTime || videoDuration) -
                            (config.watermarkStartTime || 0)) /
                            videoDuration) *
                            100
                        )}%`,
                      }}
                    >
                      Active ({currentDuration}s)
                    </div>
                  ) : config.intervalType === 'repeating' ? (
                    (() => {
                      const period = config.intervalPeriod || 20;
                      const active = config.intervalDuration || 5;
                      const segments = [];
                      for (let t = 0; t < videoDuration; t += period) {
                        const startPct = (t / videoDuration) * 100;
                        const widthPct = (Math.min(active, videoDuration - t) / videoDuration) * 100;
                        segments.push(
                          <div
                            key={t}
                            className="absolute top-0.5 bottom-0.5 rounded-md bg-amber-500 transition-all"
                            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                            title={`Active from ${formatSeconds(t)} to ${formatSeconds(
                              Math.min(videoDuration, t + active)
                            )}`}
                          />
                        );
                      }
                      return segments;
                    })()
                  ) : (
                    (config.customIntervals || []).map((item) => {
                      const startPct = Math.max(0, Math.min(100, (item.startTime / videoDuration) * 100));
                      const widthPct = Math.max(
                        1,
                        Math.min(100 - startPct, ((item.endTime - item.startTime) / videoDuration) * 100)
                      );
                      return (
                        <div
                          key={item.id}
                          className="absolute top-0.5 bottom-0.5 rounded-md bg-amber-500 shadow transition-all"
                          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                          title={`Active ${formatSeconds(item.startTime)} - ${formatSeconds(item.endTime)}`}
                        />
                      );
                    })
                  )}
                </div>

                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>0:00</span>
                  <span>{formatSeconds(videoDuration * 0.25)}</span>
                  <span>{formatSeconds(videoDuration * 0.5)}</span>
                  <span>{formatSeconds(videoDuration * 0.75)}</span>
                  <span>{formatSeconds(videoDuration)}</span>
                </div>
              </div>
            </div>

            {/* Quality & Processing Fidelity Note */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <span className="font-bold block flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Production Processing Fidelity</span>
              </span>
              <p className="text-amber-200/80">
                ETEBOX applies timing expressions and pixel-exact scale filters directly to the native video resolution ({videoWidth}×{videoHeight}) without dropping frames or compressing audio streams.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
