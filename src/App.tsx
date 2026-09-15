import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { AudioUploader } from './components/AudioUploader';
import { WaveformViewer } from './components/WaveformViewer';
import { SegmentList } from './components/SegmentList';
import { ControlPanel } from './components/ControlPanel';
import { SplitMarker, SplitSettings, AudioSegment } from './types/audio';
import {
  DEFAULT_FPS,
  RULE_8N_PLUS_1,
  sampleToFrame,
  frameToSample,
  frameToSeconds,
  snapFrameToRule,
} from './utils/audioMath';
import { detectSplitPoints } from './utils/silenceDetector';
import { buildAudioSegments } from './utils/wavExporter';
import { generateDemoAudioBuffer } from './utils/demoAudio';
import './index.css';

export const App: React.FC = () => {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [originalFilename, setOriginalFilename] = useState<string>('sample_audio.wav');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [settings, setSettings] = useState<SplitSettings>({
    fps: DEFAULT_FPS,
    rule: RULE_8N_PLUS_1,
    minFrames: 73,   // ~2.92 seconds
    maxFrames: 177,  // ~7.08 seconds
    silenceThresholdDb: -35,
    strictlySnapToGrid: true,
    strictlySnapTo8n1: true,
  });

  const [markers, setMarkers] = useState<SplitMarker[]>([]);
  const [segments, setSegments] = useState<AudioSegment[]>([]);

  // Audio Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [previewingSegmentIndex, setPreviewingSegmentIndex] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Initialize Web Audio Context
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Update segments whenever markers, audioBuffer, or settings change
  useEffect(() => {
    if (audioBuffer) {
      const segs = buildAudioSegments(audioBuffer, markers, originalFilename, settings.fps, settings.rule);
      setSegments(segs);
    } else {
      setSegments([]);
    }
  }, [audioBuffer, markers, originalFilename, settings.fps, settings.rule]);

  // Run auto silence detection
  const runAutoDetection = useCallback((buffer: AudioBuffer, currentSettings: SplitSettings = settings) => {
    const detected = detectSplitPoints(buffer, currentSettings);
    setMarkers(detected);
  }, [settings]);

  // Handle settings change with smooth marker re-quantization to new FPS / rule
  const handleSettingsChange = (newSettings: SplitSettings) => {
    if (audioBuffer && markers.length > 0 && (newSettings.fps !== settings.fps || newSettings.rule !== settings.rule)) {
      const sampleRate = audioBuffer.sampleRate;
      const fps = newSettings.fps;
      const rule = newSettings.rule;
      const strictlySnap = newSettings.strictlySnapToGrid ?? newSettings.strictlySnapTo8n1 ?? true;

      const sorted = [...markers].sort((a, b) => a.sampleIndex - b.sampleIndex);
      let prevFrame = 0;
      const updatedMarkers = sorted.map((m) => {
        let f = sampleToFrame(m.sampleIndex, sampleRate, fps);
        if (strictlySnap) {
          f = snapFrameToRule(prevFrame, f, rule, newSettings.minFrames, newSettings.maxFrames);
        }
        prevFrame = f;
        const sample = frameToSample(f, sampleRate, fps);
        const time = frameToSeconds(f, fps);
        return {
          ...m,
          frameIndex: f,
          sampleIndex: sample,
          timeSeconds: time,
        };
      });
      setMarkers(updatedMarkers);
    }
    setSettings(newSettings);
  };

  // Handle File Upload
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setOriginalFilename(file.name);
    try {
      const ctx = getAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      runAutoDetection(decodedBuffer);
      setCurrentTime(0);
      setIsPlaying(false);
    } catch (err) {
      alert('Failed to decode audio file. Please try another WAV, MP3, or FLAC file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Demo Audio Track
  const handleLoadDemoAudio = () => {
    setIsLoading(true);
    setOriginalFilename('demo_voice_dialog.wav');
    setTimeout(() => {
      const ctx = getAudioContext();
      const demoBuffer = generateDemoAudioBuffer(ctx);
      setAudioBuffer(demoBuffer);
      runAutoDetection(demoBuffer);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsLoading(false);
    }, 100);
  };

  // Playback Control
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
    setPreviewingSegmentIndex(null);
  }, []);

  const startPlaybackAt = useCallback((offset: number, durationLimit?: number) => {
    if (!audioBuffer) return;
    stopPlayback();

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    startOffsetRef.current = offset;
    startTimeRef.current = ctx.currentTime;

    if (durationLimit) {
      source.start(0, offset, durationLimit);
    } else {
      source.start(0, offset);
    }

    sourceNodeRef.current = source;
    setIsPlaying(true);

    const updateTime = () => {
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      const now = startOffsetRef.current + elapsed;

      if (now >= audioBuffer.duration || (durationLimit && elapsed >= durationLimit)) {
        stopPlayback();
        setCurrentTime(durationLimit ? startOffsetRef.current + durationLimit : 0);
      } else {
        setCurrentTime(now);
        animFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateTime);
  }, [audioBuffer, getAudioContext, stopPlayback]);

  const handlePlayToggle = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlaybackAt(currentTime);
    }
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (isPlaying) {
      startPlaybackAt(time);
    }
  };

  const handlePreviewSegment = (segment: AudioSegment) => {
    if (previewingSegmentIndex === segment.index && isPlaying) {
      stopPlayback();
    } else {
      setPreviewingSegmentIndex(segment.index);
      startPlaybackAt(segment.startTime, segment.durationSeconds);
    }
  };

  return (
    <div className="app-container">
      <Header
        hasAudio={!!audioBuffer}
        filename={originalFilename}
        duration={audioBuffer?.duration}
        sampleRate={audioBuffer?.sampleRate}
        fps={settings.fps}
        ruleName={settings.rule.name}
      />

      <main className="main-content">
        {!audioBuffer ? (
          <AudioUploader
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            onLoadDemoAudio={handleLoadDemoAudio}
          />
        ) : (
          <div className="workspace-layout">
            <WaveformViewer
              audioBuffer={audioBuffer}
              markers={markers}
              onMarkersChange={setMarkers}
              settings={settings}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onPlayToggle={handlePlayToggle}
              onSeek={handleSeek}
            />

            <ControlPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onAutoRedetect={() => audioBuffer && runAutoDetection(audioBuffer)}
              audioBuffer={audioBuffer}
              segments={segments}
              originalFilename={originalFilename}
            />

            <SegmentList
              segments={segments}
              audioBuffer={audioBuffer}
              onPreviewSegment={handlePreviewSegment}
              previewingSegmentIndex={previewingSegmentIndex}
              fps={settings.fps}
              ruleName={settings.rule.name}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
