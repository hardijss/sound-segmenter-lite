import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SplitMarker, SplitSettings } from '../types/audio';
import {
  DEFAULT_FPS,
  frameToSample,
  frameToSeconds,
  is8nPlus1,
  sampleToFrame,
  snapFrameTo8nPlus1,
  secondsToFrame,
  formatTime,
} from '../utils/audioMath';
import { Play, Pause, ZoomIn, ZoomOut, Plus, Trash2, RotateCcw } from 'lucide-react';

interface WaveformViewerProps {
  audioBuffer: AudioBuffer;
  markers: SplitMarker[];
  onMarkersChange: (markers: SplitMarker[]) => void;
  settings: SplitSettings;
  currentTime: number;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onSeek: (time: number) => void;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({
  audioBuffer,
  markers,
  onMarkersChange,
  settings,
  currentTime,
  isPlaying,
  onPlayToggle,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number>(1); // 1 to 10
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [hoverMarkerId, setHoverMarkerId] = useState<string | null>(null);

  const duration = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  const fps = settings.fps || DEFAULT_FPS;
  const totalFrames = Math.round(duration * fps);

  // Render canvas waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;

    // Time ruler & 25 FPS grid lines
    const frameWidthPx = (width / totalFrames);
    
    // Draw 25 FPS frame ticks when zoomed in
    if (frameWidthPx >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let f = 0; f < totalFrames; f++) {
        const x = f * frameWidthPx;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw waveform peaks
    const centerY = height / 2;
    const waveHeight = height * 0.7;

    ctx.fillStyle = '#38bdf8';
    const sampleStep = Math.max(1, Math.floor(totalSamples / width));

    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const sampleStart = Math.floor((x / width) * totalSamples);
      const sampleEnd = Math.min(totalSamples, sampleStart + sampleStep);

      let min = 1.0;
      let max = -1.0;

      for (let s = sampleStart; s < sampleEnd; s++) {
        const val = channelData[s];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      if (min > max) {
        min = 0;
        max = 0;
      }

      const yMin = centerY + min * (waveHeight / 2);
      const yMax = centerY + max * (waveHeight / 2);

      ctx.fillRect(x, yMin, 1, Math.max(1, yMax - yMin));
    }

    // Sort markers to color code segments
    const sorted = [...markers].sort((a, b) => a.sampleIndex - b.sampleIndex);
    const bounds = [0, ...sorted.map((m) => m.frameIndex), totalFrames];

    // Segment background alternating tint
    for (let i = 0; i < bounds.length - 1; i++) {
      const startX = (bounds[i] / totalFrames) * width;
      const endX = (bounds[i + 1] / totalFrames) * width;
      const frameCount = bounds[i + 1] - bounds[i];
      const check8n = is8nPlus1(frameCount);

      ctx.fillStyle = check8n.valid
        ? (i % 2 === 0 ? 'rgba(56, 189, 248, 0.06)' : 'rgba(99, 102, 241, 0.06)')
        : 'rgba(239, 68, 68, 0.12)';

      ctx.fillRect(startX, 0, endX - startX, height);

      // Label segment frame length
      if (endX - startX > 40) {
        ctx.fillStyle = check8n.valid ? '#94a3b8' : '#f87171';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const labelStr = check8n.valid
          ? `${frameCount}f (8n+1, n=${check8n.n})`
          : `${frameCount}f ⚠️`;
        ctx.fillText(labelStr, (startX + endX) / 2, height - 12);
      }
    }

    // Draw split markers
    markers.forEach((m) => {
      const x = (m.frameIndex / totalFrames) * width;
      const isSelected = m.id === selectedMarkerId;
      const isHovered = m.id === hoverMarkerId || m.id === draggingMarkerId;

      ctx.strokeStyle = isSelected
        ? '#fbbf24'
        : isHovered
        ? '#f43f5e'
        : m.isUserOverridden
        ? '#ec4899'
        : '#10b981';

      ctx.lineWidth = isSelected || isHovered ? 3 : 2;

      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(x, 24);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top handle tag
      ctx.fillStyle = isSelected
        ? '#fbbf24'
        : isHovered
        ? '#f43f5e'
        : m.isUserOverridden
        ? '#ec4899'
        : '#10b981';

      const tagWidth = 44;
      const tagHeight = 20;
      ctx.fillRect(x - tagWidth / 2, 4, tagWidth, tagHeight);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.frameIndex}f`, x, 18);
    });

    // Playhead line
    const playheadX = (currentTime / duration) * width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead head handle
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(playheadX, 6, 6, 0, Math.PI * 2);
    ctx.fill();

  }, [audioBuffer, markers, selectedMarkerId, hoverMarkerId, draggingMarkerId, currentTime, duration, totalFrames, fps]);

  // Canvas size sync
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = container.clientWidth * zoom;
      canvas.height = 200;
      draw();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [draw, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Pointer event handlers for marker dragging & clicking
  const getFrameFromClientX = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(ratio * totalFrames);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const frame = getFrameFromClientX(e.clientX);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if clicked near existing marker
    const width = canvas.width;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    let nearestMarker: SplitMarker | null = null;
    let minDistancePx = 15; // 15px grab radius

    markers.forEach((m) => {
      const markerX = (m.frameIndex / totalFrames) * rect.width;
      const dist = Math.abs(clickX - markerX);
      if (dist < minDistancePx) {
        minDistancePx = dist;
        nearestMarker = m;
      }
    });

    if (nearestMarker) {
      setSelectedMarkerId((nearestMarker as SplitMarker).id);
      setDraggingMarkerId((nearestMarker as SplitMarker).id);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setSelectedMarkerId(null);
      // Seek to click position
      const clickedTime = (frame / totalFrames) * duration;
      onSeek(clickedTime);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    if (draggingMarkerId) {
      const candidateFrame = getFrameFromClientX(e.clientX);
      
      // Find previous split point to compute 8n+1 snap
      const sorted = [...markers].sort((a, b) => a.frameIndex - b.frameIndex);
      const mIdx = sorted.findIndex((m) => m.id === draggingMarkerId);
      const prevFrame = mIdx > 0 ? sorted[mIdx - 1].frameIndex : 0;

      let targetFrame = candidateFrame;

      if (settings.strictlySnapTo8n1) {
        targetFrame = snapFrameTo8nPlus1(
          prevFrame,
          candidateFrame,
          settings.minFrames,
          settings.maxFrames
        );
      }

      // Clamp frame bounds
      targetFrame = Math.max(1, Math.min(totalFrames - 1, targetFrame));

      const targetSample = frameToSample(targetFrame, sampleRate, fps);
      const targetTime = frameToSeconds(targetFrame, fps);

      onMarkersChange(
        markers.map((m) =>
          m.id === draggingMarkerId
            ? {
                ...m,
                frameIndex: targetFrame,
                sampleIndex: targetSample,
                timeSeconds: targetTime,
                isUserOverridden: true,
              }
            : m
        )
      );
    } else {
      // Hover detection
      let hovered: SplitMarker | null = null;
      let minDistancePx = 15;

      markers.forEach((m) => {
        const markerX = (m.frameIndex / totalFrames) * rect.width;
        const dist = Math.abs(clickX - markerX);
        if (dist < minDistancePx) {
          minDistancePx = dist;
          hovered = m;
        }
      });

      setHoverMarkerId(hovered ? (hovered as SplitMarker).id : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingMarkerId) {
      setDraggingMarkerId(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const candidateFrame = getFrameFromClientX(e.clientX);

    // Snap to 8n+1 relative to nearest preceding marker
    const sorted = [...markers].sort((a, b) => a.frameIndex - b.frameIndex);
    let prevFrame = 0;
    for (const m of sorted) {
      if (m.frameIndex < candidateFrame) {
        prevFrame = m.frameIndex;
      }
    }

    const targetFrame = settings.strictlySnapTo8n1
      ? snapFrameTo8nPlus1(prevFrame, candidateFrame, settings.minFrames, settings.maxFrames)
      : candidateFrame;

    const newMarker: SplitMarker = {
      id: `marker-user-${Date.now()}`,
      timeSeconds: frameToSeconds(targetFrame, fps),
      sampleIndex: frameToSample(targetFrame, sampleRate, fps),
      frameIndex: targetFrame,
      isAutoDetected: false,
      isUserOverridden: true,
    };

    onMarkersChange([...markers, newMarker]);
    setSelectedMarkerId(newMarker.id);
  };

  const handleDeleteSelected = () => {
    if (selectedMarkerId) {
      onMarkersChange(markers.filter((m) => m.id !== selectedMarkerId));
      setSelectedMarkerId(null);
    }
  };

  return (
    <div className="waveform-section">
      <div className="waveform-toolbar">
        <div className="toolbar-left">
          <button className="play-btn" onClick={onPlayToggle}>
            {isPlaying ? <Pause className="btn-icon" /> : <Play className="btn-icon" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)} (Frame {secondsToFrame(currentTime, fps)}/{totalFrames})
          </span>
        </div>

        <div className="toolbar-right">
          <button
            className="tool-btn"
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            disabled={zoom <= 1}
            title="Zoom out waveform"
          >
            <ZoomOut className="btn-icon" />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="tool-btn"
            onClick={() => setZoom((z) => Math.min(5, z + 0.5))}
            disabled={zoom >= 5}
            title="Zoom in waveform"
          >
            <ZoomIn className="btn-icon" />
          </button>

          <button
            className="tool-btn delete-btn"
            onClick={handleDeleteSelected}
            disabled={!selectedMarkerId}
            title="Delete selected marker"
          >
            <Trash2 className="btn-icon" /> Delete Selected
          </button>
        </div>
      </div>

      <div className="waveform-scroll-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          className="waveform-canvas"
          style={{ cursor: draggingMarkerId ? 'grabbing' : hoverMarkerId ? 'ew-resize' : 'crosshair' }}
        />
      </div>

      <div className="waveform-hint">
        💡 <strong>Tips:</strong> Double-click waveform to insert split marker. Drag vertical markers to adjust. Markers automatically snap to 25 FPS $8n+1$ grid points.
      </div>
    </div>
  );
};
