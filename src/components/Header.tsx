import React from 'react';
import { Scissors, Film, Clock } from 'lucide-react';

interface HeaderProps {
  hasAudio: boolean;
  filename?: string;
  duration?: number;
  sampleRate?: number;
  fps?: number;
  ruleName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  hasAudio,
  filename,
  duration,
  sampleRate,
  fps = 25,
  ruleName = '8n+1',
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-icon">
          <Scissors className="icon-scissors" />
        </div>
        <div>
          <h1 className="app-title">AudioSplit <span className="highlight">{fps}FPS {ruleName}</span></h1>
          <p className="app-subtitle">
            Precision audio segmentation aligned to {fps} FPS ${ruleName}$ frame rules & silence detection
          </p>
        </div>
      </div>

      {hasAudio && (
        <div className="audio-meta-bar">
          <div className="meta-item">
            <Film className="meta-icon" />
            <span>{fps} FPS Grid ({ruleName})</span>
          </div>
          <div className="meta-item">
            <Clock className="meta-icon" />
            <span>{duration?.toFixed(2)}s</span>
          </div>
          <div className="meta-badge">
            {sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : ''}
          </div>
          <div className="filename-tag" title={filename}>
            {filename}
          </div>
        </div>
      )}
    </header>
  );
};
