import React from 'react';
import { Scissors, Film, Clock, Sparkles } from 'lucide-react';

interface HeaderProps {
  hasAudio: boolean;
  filename?: string;
  duration?: number;
  sampleRate?: number;
}

export const Header: React.FC<HeaderProps> = ({
  hasAudio,
  filename,
  duration,
  sampleRate,
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-icon">
          <Scissors className="icon-scissors" />
        </div>
        <div>
          <h1 className="app-title">AudioSplit <span className="highlight">25FPS 8n+1</span></h1>
          <p className="app-subtitle">
            Precision audio segmentation aligned to 25 FPS $8n+1$ frame rules & silence detection
          </p>
        </div>
      </div>

      {hasAudio && (
        <div className="audio-meta-bar">
          <div className="meta-item">
            <Film className="meta-icon" />
            <span>25 FPS Grid</span>
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
