import React, { useState } from 'react';
import { SplitSettings, AudioSegment, ChunkingRule } from '../types/audio';
import { downloadAllSegmentsAsZip, downloadFrameManifestTxt } from '../utils/wavExporter';
import {
  PRESETS,
  STANDARD_FPS_OPTIONS,
  frameToSeconds,
  getValidRuleFrameCounts,
} from '../utils/audioMath';
import { RefreshCw, Download, Sliders, CheckSquare, Square, FileText, Sparkles, Settings2 } from 'lucide-react';

interface ControlPanelProps {
  settings: SplitSettings;
  onSettingsChange: (settings: SplitSettings) => void;
  onAutoRedetect: () => void;
  audioBuffer: AudioBuffer;
  segments: AudioSegment[];
  originalFilename: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  onAutoRedetect,
  audioBuffer,
  segments,
  originalFilename,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Determine active preset (if matches Wan2.1 or Cinematic, or 'custom')
  const getActivePresetId = (): string => {
    if (settings.fps === 25 && settings.rule.multiplier === 8 && settings.rule.offset === 1) {
      return 'wan21-25fps-8n1';
    }
    if (settings.fps === 24 && settings.rule.multiplier === 17 && settings.rule.offset === 5) {
      return 'cinematic-24fps-17n5';
    }
    return 'custom';
  };

  const activePresetId = getActivePresetId();
  const [isCustomMode, setIsCustomMode] = useState<boolean>(activePresetId === 'custom');

  const handleSelectPreset = (presetId: string) => {
    if (presetId === 'custom') {
      setIsCustomMode(true);
      return;
    }
    setIsCustomMode(false);
    const found = PRESETS.find((p) => p.id === presetId);
    if (found) {
      onSettingsChange({
        ...settings,
        fps: found.fps,
        rule: found.rule,
        minFrames: found.defaultMinFrames,
        maxFrames: found.defaultMaxFrames,
      });
    }
  };

  const handleFpsSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'other') {
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onSettingsChange({ ...settings, fps: num });
    }
  };

  const handleCustomFpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num > 0) {
      onSettingsChange({ ...settings, fps: num });
    }
  };

  const handleMultiplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const mult = Math.max(1, parseInt(e.target.value, 10) || 1);
    const newRule: ChunkingRule = {
      ...settings.rule,
      multiplier: mult,
      name: `${mult}n+${settings.rule.offset}`,
    };
    onSettingsChange({
      ...settings,
      rule: newRule,
    });
  };

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const offset = Math.max(0, parseInt(e.target.value, 10) || 0);
    const newRule: ChunkingRule = {
      ...settings.rule,
      offset,
      name: `${settings.rule.multiplier}n+${offset}`,
    };
    onSettingsChange({
      ...settings,
      rule: newRule,
    });
  };

  const handleMinFramesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onSettingsChange({ ...settings, minFrames: val });
  };

  const handleMaxFramesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onSettingsChange({ ...settings, maxFrames: val });
  };

  const handleExportZip = async () => {
    setIsExporting(true);
    setExportProgress(0);
    try {
      await downloadAllSegmentsAsZip(
        audioBuffer,
        segments,
        originalFilename,
        (percent) => {
          setExportProgress(percent);
        },
        settings.fps,
        settings.rule
      );
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTxtOnly = () => {
    downloadFrameManifestTxt(segments, originalFilename, settings.fps, settings.rule.name);
  };

  const strictlySnap = settings.strictlySnapToGrid ?? settings.strictlySnapTo8n1 ?? true;

  // Generate preview sequence of valid lengths
  const previewLengths = getValidRuleFrameCounts(settings.rule, 1, 200).slice(0, 8);

  const isStandardFps = STANDARD_FPS_OPTIONS.some((opt) => Math.abs(opt.value - settings.fps) < 0.001);

  return (
    <div className="control-panel-card">
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <Sliders className="card-icon" />
          <h3 className="panel-title">Splitting Controls & Export</h3>
        </div>
      </div>

      {/* Preset Selector Bar */}
      <div className="preset-bar">
        <div className="preset-label">
          <Sparkles className="sm-icon" /> Presets:
        </div>
        <div className="preset-pills">
          <button
            type="button"
            className={`preset-pill-btn ${activePresetId === 'wan21-25fps-8n1' && !isCustomMode ? 'active' : ''}`}
            onClick={() => handleSelectPreset('wan21-25fps-8n1')}
          >
            Wan 2.1 (25 FPS • 8n+1)
          </button>
          <button
            type="button"
            className={`preset-pill-btn ${activePresetId === 'cinematic-24fps-17n5' && !isCustomMode ? 'active' : ''}`}
            onClick={() => handleSelectPreset('cinematic-24fps-17n5')}
          >
            Cinematic (24 FPS • 17n+5)
          </button>
          <button
            type="button"
            className={`preset-pill-btn ${isCustomMode ? 'active' : ''}`}
            onClick={() => handleSelectPreset('custom')}
          >
            <Settings2 className="sm-icon" /> Custom FPS & Rule
          </button>
        </div>
      </div>

      {/* Custom Configuration Section */}
      {isCustomMode && (
        <div className="custom-config-card">
          <div className="custom-config-header">
            <span>Custom Frame Rate & Chunking Formula</span>
          </div>

          <div className="custom-inputs-grid">
            <div className="setting-group">
              <label className="setting-label">Frame Rate (FPS):</label>
              <select
                className="select-input"
                value={isStandardFps ? settings.fps.toString() : 'other'}
                onChange={handleFpsSelectChange}
              >
                {STANDARD_FPS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="other">Custom Number...</option>
              </select>
              {!isStandardFps && (
                <input
                  type="number"
                  step="any"
                  min="1"
                  max="240"
                  value={settings.fps}
                  onChange={handleCustomFpsChange}
                  className="text-input"
                  placeholder="Enter custom FPS"
                />
              )}
            </div>

            <div className="setting-group">
              <label className="setting-label">Rule Multiplier A (Step):</label>
              <input
                type="number"
                min="1"
                max="500"
                value={settings.rule.multiplier}
                onChange={handleMultiplierChange}
                className="text-input"
              />
            </div>

            <div className="setting-group">
              <label className="setting-label">Rule Offset B (Base):</label>
              <input
                type="number"
                min="0"
                max="500"
                value={settings.rule.offset}
                onChange={handleOffsetChange}
                className="text-input"
              />
            </div>
          </div>

          <div className="formula-preview-wrapper">
            <span>Active Formula:</span>
            <span className="formula-badge">
              N = {settings.rule.multiplier}n + {settings.rule.offset}
            </span>
            <span className="sequence-preview">
              Valid lengths: {previewLengths.join(', ')}...
            </span>
          </div>
        </div>
      )}

      {/* Settings Grid for Range Sliders */}
      <div className="settings-grid">
        <div className="setting-group">
          <label className="setting-label">
            Target Min Length: <strong>{settings.minFrames} frames</strong> ({frameToSeconds(settings.minFrames, settings.fps).toFixed(2)}s)
          </label>
          <input
            type="range"
            min={Math.max(1, settings.rule.offset)}
            max="501"
            step={Math.max(1, settings.rule.multiplier)}
            value={settings.minFrames}
            onChange={handleMinFramesChange}
            className="range-input"
          />
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Target Max Length: <strong>{settings.maxFrames} frames</strong> ({frameToSeconds(settings.maxFrames, settings.fps).toFixed(2)}s)
          </label>
          <input
            type="range"
            min={Math.max(settings.rule.offset + settings.rule.multiplier, settings.minFrames)}
            max="1001"
            step={Math.max(1, settings.rule.multiplier)}
            value={settings.maxFrames}
            onChange={handleMaxFramesChange}
            className="range-input"
          />
        </div>

        <div className="setting-group checkbox-group">
          <button
            type="button"
            className="checkbox-btn"
            onClick={() =>
              onSettingsChange({
                ...settings,
                strictlySnapToGrid: !strictlySnap,
                strictlySnapTo8n1: !strictlySnap,
              })
            }
          >
            {strictlySnap ? (
              <CheckSquare className="check-icon active" />
            ) : (
              <Square className="check-icon" />
            )}
            <span>Strictly snap dragged markers to {settings.fps} FPS {settings.rule.name} grid</span>
          </button>
        </div>
      </div>

      <div className="panel-actions">
        <button className="btn-secondary" onClick={onAutoRedetect}>
          <RefreshCw className="btn-icon" /> Auto-Detect Silence Splits
        </button>

        <button className="btn-secondary" onClick={handleExportTxtOnly} disabled={segments.length === 0}>
          <FileText className="btn-icon" /> Export Frame Lengths (.txt)
        </button>

        <button className="btn-primary" onClick={handleExportZip} disabled={isExporting || segments.length === 0}>
          <Download className="btn-icon" /> {isExporting ? `Zipping (${exportProgress}%)...` : `Export All (${segments.length} WAVs + TXT)`}
        </button>
      </div>

      {isExporting && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }}></div>
        </div>
      )}
    </div>
  );
};

