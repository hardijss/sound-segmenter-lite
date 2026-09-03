import React, { useState } from 'react';
import { AudioSegment } from '../types/audio';
import { downloadSegmentAsWav } from '../utils/wavExporter';
import { Play, Pause, Download, CheckCircle2, AlertTriangle, FileAudio } from 'lucide-react';
import { formatTime } from '../utils/audioMath';

interface SegmentListProps {
  segments: AudioSegment[];
  audioBuffer: AudioBuffer;
  onPreviewSegment: (segment: AudioSegment) => void;
  previewingSegmentIndex: number | null;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  audioBuffer,
  onPreviewSegment,
  previewingSegmentIndex,
}) => {
  const invalidCount = segments.filter((s) => !s.is8nPlus1).length;
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
              <CheckCircle2 className="badge-icon" /> All {totalSegments} segments are 25 FPS 8n+1 valid
            </span>
          ) : (
            <span className="status-badge badge-warning">
              <AlertTriangle className="badge-icon" /> {invalidCount} segment(s) deviate from 8n+1
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
              <th>25 FPS Frames</th>
              <th>8n+1 Status</th>
              <th>Avg Volume</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => {
              const isPlayingThis = previewingSegmentIndex === seg.index;
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
                    {seg.is8nPlus1 ? (
                      <span className="badge-8n1-valid">
                        ✓ 8n+1 (n={seg.nValue})
                      </span>
                    ) : (
                      <span className="badge-8n1-invalid">
                        ⚠️ Non-8n+1 ({seg.frameCount}f)
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
