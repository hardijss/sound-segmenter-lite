export interface ChunkingRule {
  multiplier: number; // A in A*n + B (e.g. 8 or 17)
  offset: number;     // B in A*n + B (e.g. 1 or 5)
  name: string;       // human readable label, e.g. "8n+1", "17n+5"
}

export interface SplitPreset {
  id: string;
  label: string;
  fps: number;
  rule: ChunkingRule;
  defaultMinFrames: number;
  defaultMaxFrames: number;
}

export interface SplitMarker {
  id: string;
  timeSeconds: number; // exact timestamp in seconds
  sampleIndex: number; // exact sample index in original audio buffer
  frameIndex: number;  // frame index at current fps
  isAutoDetected: boolean;
  isUserOverridden: boolean;
}

export interface AudioSegment {
  index: number;              // 1-based segment index
  filename: string;           // e.g. "my_track_0001.wav"
  startTime: number;          // start time in seconds
  endTime: number;            // end time in seconds
  startSample: number;        // start sample index
  endSample: number;          // end sample index
  durationSeconds: number;    // duration in seconds
  frameCount: number;         // duration in frames at active fps
  isValidRule: boolean;       // true if frameCount satisfies active ChunkingRule
  ruleLabel: string;          // formatted rule status, e.g. "17n+5 (n=4)" or "8n+1 (n=9)"
  is8nPlus1?: boolean;        // backward-compatibility flag
  nValue: number | null;      // integer n if rule is satisfied, else null
  rmsLevelDb: number;         // average energy/RMS level of segment
}

export interface SplitSettings {
  fps: number;                // e.g. 25, 24, 23.976, 30, etc.
  rule: ChunkingRule;         // active A*n + B rule
  minFrames: number;          // e.g. 73
  maxFrames: number;          // e.g. 177
  silenceThresholdDb: number; // e.g. -35 dB
  strictlySnapToGrid: boolean;// auto-snap dragged markers to valid rule frames
  strictlySnapTo8n1?: boolean;// backward-compatibility alias
}

