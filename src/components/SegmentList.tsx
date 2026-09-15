import React from 'react';
import { AudioSegment } from '../types/audio';
import { downloadSegmentAsWav } from '../utils/wavExporter';
import { Play, Pause, Download, CheckCircle2, AlertTriangle, FileAudio } from 'lucide-react';
import { formatTime } from '../utils/audioMath';

interface SegmentListProps {
  segments: AudioSegment[];
  audioBuffer: AudioBuffer;
  onPreviewSegment: (segment: AudioSegment) => void;
  previewingSegmentIndex: number | null;
  fps?: number;
  ruleName?: string;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  audioBuffer,
  onPreviewSegment,
  previewingSegmentIndex,
  fps = 25,
  ruleName = '8n+1',
}) => {
  const invalidCount = segments.filter((s) => s.isValidRule !== undefined ? !s.isValidRule : !s.is8nPlus1).length;
  const totalSegments = segments.length;

  return (
    <div className="segments-card">
      <div className="segments-header">
        <div className="segments-title-wrapper">
          <FileAudio className="card-icon" />
          <h2 className="card-title">Output Segments ({totalSegments})</h2>
        </div>

        <div className="segments-summary-badges">
          {invalidCount === 0 ? (
            <span className="status-badge badge-success">
              <CheckCircle2 className="badge-icon" /> All {totalSegments} segments are {fps} FPS {ruleName} valid
            </span>
          ) : (
            <span className="status-badge badge-warning">
              <AlertTriangle className="badge-icon" /> {invalidCount} segment(s) deviate from {ruleName}
            </span>
          )}
        </div>
      </div>

      <div className="segments-table-wrapper">
        <table className="segments-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Output Filename</th>
              <th>Time Range</th>
              <th>Duration</th>
              <th>{fps} FPS Frames</th>
              <th>{ruleName} Status</th>
              <th>Avg Volume</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => {
              const isPlayingThis = previewingSegmentIndex === seg.index;
              const isValid = seg.isValidRule !== undefined ? seg.isValidRule : !!seg.is8nPlus1;
              return (
                <tr key={seg.index} className={isPlayingThis ? 'row-active' : ''}>
                  <td className="font-mono text-muted">{seg.index}</td>
                  <td className="font-mono filename-cell">{seg.filename}</td>
                  <td className="text-muted font-mono">
                    {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
                  </td>
                  <td className="font-mono">{seg.durationSeconds.toFixed(3)}s</td>
                  <td className="font-mono">
                    <span className="frame-count-pill">{seg.frameCount} frames</span>
                  </td>
                  <td>
                    {isValid ? (
                      <span className="badge-8n1-valid">
                        ✓ {seg.ruleLabel || `${ruleName} (n=${seg.nValue})`}
                      </span>
                    ) : (
                      <span className="badge-8n1-invalid">
                        ⚠️ {seg.ruleLabel || `Non-${ruleName} (${seg.frameCount}f)`}
                      </span>
                    )}
                  </td>
                  <td className="text-muted font-mono">{seg.rmsLevelDb} dB</td>
                  <td className="text-right actions-cell">
                    <button
                      className={`btn-icon-sm ${isPlayingThis ? 'btn-playing' : ''}`}
                      onClick={() => onPreviewSegment(seg)}
                      title="Play segment preview"
                    >
                      {isPlayingThis ? <Pause className="sm-icon" /> : <Play className="sm-icon" />}
                    </button>
                    <button
                      className="btn-icon-sm"
                      onClick={() => downloadSegmentAsWav(audioBuffer, seg)}
                      title="Download this segment WAV"
                    >
                      <Download className="sm-icon" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
