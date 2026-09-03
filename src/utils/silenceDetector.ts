import { SplitMarker, SplitSettings } from '../types/audio';
import {
  DEFAULT_FPS,
  getSamplesPerFrame,
  getValid8nPlus1FrameCounts,
  frameToSample,
  frameToSeconds,
  sampleToFrame,
} from './audioMath';

/**
 * Computes per-frame RMS (Root Mean Square) energy of an AudioBuffer at 25 FPS.
 */
export function computeFrameEnergy(
  audioBuffer: AudioBuffer,
  fps: number = DEFAULT_FPS
): { frameRms: Float32Array; frameDb: Float32Array; totalFrames: number } {
  const sampleRate = audioBuffer.sampleRate;
  const samplesPerFrame = getSamplesPerFrame(sampleRate, fps);
  const channelData = audioBuffer.getChannelData(0); // Use mono / first channel for energy
  const totalSamples = audioBuffer.length;
  const totalFrames = Math.ceil(totalSamples / samplesPerFrame);

  const frameRms = new Float32Array(totalFrames);
  const frameDb = new Float32Array(totalFrames);

  for (let f = 0; f < totalFrames; f++) {
    const startSample = Math.floor(f * samplesPerFrame);
    const endSample = Math.min(totalSamples, Math.floor((f + 1) * samplesPerFrame));
    const count = endSample - startSample;

    if (count <= 0) {
      frameRms[f] = 0;
      frameDb[f] = -100;
      continue;
    }

    let sumSquare = 0;
    for (let s = startSample; s < endSample; s++) {
      const val = channelData[s];
      sumSquare += val * val;
    }

    const rms = Math.sqrt(sumSquare / count);
    frameRms[f] = rms;
    // Prevent log10(0)
    const db = 20 * Math.log10(Math.max(rms, 1e-6));
    frameDb[f] = db;
  }

  return { frameRms, frameDb, totalFrames };
}

/**
 * Uses Dynamic Programming to find the optimal set of 8n+1 frame split points
 * that land on silent/quiet frames.
 */
export function detect8nPlus1SplitPoints(
  audioBuffer: AudioBuffer,
  settings: SplitSettings
): SplitMarker[] {
  const fps = settings.fps || DEFAULT_FPS;
  const sampleRate = audioBuffer.sampleRate;
  const { frameRms, frameDb, totalFrames } = computeFrameEnergy(audioBuffer, fps);

  const validFrameLengths = getValid8nPlus1FrameCounts(settings.minFrames, settings.maxFrames);

  if (validFrameLengths.length === 0 || totalFrames <= settings.minFrames) {
    return [];
  }

  // DP table: dp[f] stores minimum cumulative penalty cost to reach frame f
  // parent[f] stores the previous split frame index
  const INF = 1e12;
  const dp = new Float32Array(totalFrames + 1).fill(INF);
  const parent = new Int32Array(totalFrames + 1).fill(-1);

  dp[0] = 0;

  for (let f = 1; f <= totalFrames; f++) {
    let minCost = INF;
    let bestPrev = -1;

    for (const len of validFrameLengths) {
      const prev = f - len;
      if (prev < 0) continue;
      if (dp[prev] >= INF) continue;

      // Energy penalty at split point f
      // Lower dB (quieter) = lower penalty
      // Normalize dB from [-100, 0] to positive penalty
      const dbVal = f < totalFrames ? frameDb[f] : frameDb[totalFrames - 1];
      const silenceCost = Math.max(0, dbVal + 100); // 0 for quietest, 100 for loud

      // Small penalty preference for mid-range lengths (~121-137 frames ~ 5s)
      const idealLen = 129; // ~5.16 seconds
      const lengthPenalty = Math.abs(len - idealLen) * 0.05;

      const totalCost = dp[prev] + silenceCost + lengthPenalty;

      if (totalCost < minCost) {
        minCost = totalCost;
        bestPrev = prev;
      }
    }

    // Also handle trailing end of audio: if f is near totalFrames, allow last segment to reach totalFrames
    if (f === totalFrames && bestPrev === -1) {
      // Find closest valid length from back
      for (let prev = totalFrames - settings.maxFrames; prev <= totalFrames - settings.minFrames; prev++) {
        if (prev >= 0 && dp[prev] < INF) {
          const remLen = totalFrames - prev;
          // check if remLen can be approximated or allowed
          const cost = dp[prev] + 10;
          if (cost < minCost) {
            minCost = cost;
            bestPrev = prev;
          }
        }
      }
    }

    if (bestPrev !== -1) {
      dp[f] = minCost;
      parent[f] = bestPrev;
    }
  }

  // Reconstruct split markers path
  const splitFrames: number[] = [];
  let curr = totalFrames;

  // If dp[totalFrames] is unreachable, backtrack from the best reachable frame near the end
  if (dp[curr] >= INF) {
    let bestFrame = -1;
    let minVal = INF;
    for (let f = totalFrames - 1; f >= Math.max(0, totalFrames - settings.maxFrames); f--) {
      if (dp[f] < minVal) {
        minVal = dp[f];
        bestFrame = f;
      }
    }
    if (bestFrame !== -1) {
      curr = bestFrame;
    } else {
      // Fallback naive uniform 8n+1 splitting
      let p = 0;
      const defaultStep = validFrameLengths[Math.floor(validFrameLengths.length / 2)] || 121;
      while (p + defaultStep < totalFrames) {
        p += defaultStep;
        splitFrames.push(p);
      }
      return buildSplitMarkers(splitFrames, sampleRate, fps);
    }
  }

  while (curr > 0 && parent[curr] !== -1) {
    const prev = parent[curr];
    if (prev > 0) {
      splitFrames.push(prev);
    }
    curr = prev;
  }

  splitFrames.reverse();

  return buildSplitMarkers(splitFrames, sampleRate, fps);
}

function buildSplitMarkers(frameIndices: number[], sampleRate: number, fps: number): SplitMarker[] {
  return frameIndices.map((frameIdx, index) => {
    const sampleIdx = frameToSample(frameIdx, sampleRate, fps);
    const timeSecs = frameToSeconds(frameIdx, fps);

    return {
      id: `marker-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timeSeconds: timeSecs,
      sampleIndex: sampleIdx,
      frameIndex: frameIdx,
      isAutoDetected: true,
      isUserOverridden: false,
    };
  });
}
