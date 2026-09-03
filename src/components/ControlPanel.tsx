import React, { useState } from 'react';
import { SplitSettings, AudioSegment } from '../types/audio';
import { downloadAllSegmentsAsZip, downloadFrameManifestTxt } from '../utils/wavExporter';
import { Settings, RefreshCw, Download, Sliders, CheckSquare, Square, FileText } from 'lucide-react';
import { frameToSeconds } from '../utils/audioMath';

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
      await downloadAllSegmentsAsZip(audioBuffer, segments, originalFilename, (percent) => {
        setExportProgress(percent);
      });
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTxtOnly = () => {
    downloadFrameManifestTxt(segments, originalFilename);
  };

  return (
    <div className="control-panel-card">
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <Sliders className="card-icon" />
          <h3 className="panel-title">Splitting Controls & Export</h3>
        </div>
      </div>

      <div className="settings-grid">
        <div className="setting-group">
          <label className="setting-label">
            Target Min Length: <strong>{settings.minFrames} frames</strong> ({frameToSeconds(settings.minFrames).toFixed(2)}s)
          </label>
          <input
            type="range"
            min="41"
            max="501"
            step="8"
            value={settings.minFrames}
            onChange={handleMinFramesChange}
            className="range-input"
          />
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Target Max Length: <strong>{settings.maxFrames} frames</strong> ({frameToSeconds(settings.maxFrames).toFixed(2)}s)
          </label>
          <input
            type="range"
            min="129"
            max="1001"
            step="8"
            value={settings.maxFrames}
            onChange={handleMaxFramesChange}
            className="range-input"
          />
        </div>

        <div className="setting-group checkbox-group">
          <button
            type="button"
            className="checkbox-btn"
            onClick={() => onSettingsChange({ ...settings, strictlySnapTo8n1: !settings.strictlySnapTo8n1 })}
          >
            {settings.strictlySnapTo8n1 ? (
              <CheckSquare className="check-icon active" />
            ) : (
              <Square className="check-icon" />
            )}
            <span>Strictly snap dragged markers to 25 FPS 8n+1 grid</span>
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
