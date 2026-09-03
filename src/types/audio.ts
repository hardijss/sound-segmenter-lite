export interface SplitMarker {
  id: string;
  timeSeconds: number; // exact timestamp in seconds
  sampleIndex: number; // exact sample index in original audio buffer
  frameIndex: number;  // 25fps frame index (sampleIndex / samplesPerFrame)
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
  frameCount: number;         // duration in 25fps frames
  is8nPlus1: boolean;         // true if frameCount = 8n + 1
  nValue: number | null;      // integer n if is8nPlus1 is true, else null
  rmsLevelDb: number;         // average energy/RMS level of segment
}

export interface SplitSettings {
  fps: number;                // default 25
  minFrames: number;          // e.g. 73 frames (~2.92s) or 81 frames (~3.24s)
  maxFrames: number;          // e.g. 177 frames (~7.08s) or 169 frames (~6.76s)
  silenceThresholdDb: number; // e.g. -35 dB
  strictlySnapTo8n1: boolean; // auto-snap dragged markers to valid 8n+1 frames
}
