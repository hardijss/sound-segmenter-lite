/**
 * Utility functions for 25 FPS sample-exact and frame-exact audio arithmetic.
 */

import { ChunkingRule, SplitPreset } from '../types/audio';

export const DEFAULT_FPS = 25;

export const RULE_8N_PLUS_1: ChunkingRule = {
  multiplier: 8,
  offset: 1,
  name: '8n+1',
};

export const RULE_17N_PLUS_5: ChunkingRule = {
  multiplier: 17,
  offset: 5,
  name: '17n+5',
};

export const PRESET_WAN21: SplitPreset = {
  id: 'wan21-25fps-8n1',
  label: 'Wan 2.1 (25 FPS • 8n+1)',
  fps: 25,
  rule: RULE_8N_PLUS_1,
  defaultMinFrames: 73,   // ~2.92s (8*9+1 = 73)
  defaultMaxFrames: 177,  // ~7.08s (8*22+1 = 177)
};

export const PRESET_CINEMATIC_24FPS: SplitPreset = {
  id: 'cinematic-24fps-17n5',
  label: 'Cinematic (24 FPS • 17n+5)',
  fps: 24,
  rule: RULE_17N_PLUS_5,
  defaultMinFrames: 73,   // ~3.04s (17*4+5 = 73)
  defaultMaxFrames: 175,  // ~7.29s (17*10+5 = 175)
};

export const PRESETS: SplitPreset[] = [
  PRESET_WAN21,
  PRESET_CINEMATIC_24FPS,
];

export const STANDARD_FPS_OPTIONS = [
  { label: '23.976 FPS (Film / NTSC)', value: 23.976 },
  { label: '24 FPS (Cinema Standard)', value: 24 },
  { label: '25 FPS (PAL / Wan 2.1)', value: 25 },
  { label: '29.97 FPS (NTSC Broadcast)', value: 29.97 },
  { label: '30 FPS (Digital Video)', value: 30 },
  { label: '50 FPS (PAL High Frame Rate)', value: 50 },
  { label: '59.94 FPS (NTSC High Frame Rate)', value: 59.94 },
  { label: '60 FPS (Digital High Frame Rate)', value: 60 },
];

/**
 * Calculates exact samples per frame at a given sample rate and FPS.
 */
export function getSamplesPerFrame(sampleRate: number, fps: number = DEFAULT_FPS): number {
  return sampleRate / fps;
}

/**
 * Converts frame index to exact sample index.
 */
export function frameToSample(frameIndex: number, sampleRate: number, fps: number = DEFAULT_FPS): number {
  return Math.round(frameIndex * getSamplesPerFrame(sampleRate, fps));
}

/**
 * Converts sample index to nearest frame index.
 */
export function sampleToFrame(sampleIndex: number, sampleRate: number, fps: number = DEFAULT_FPS): number {
  return Math.round(sampleIndex / getSamplesPerFrame(sampleRate, fps));
}

/**
 * Converts seconds to nearest frame index.
 */
export function secondsToFrame(seconds: number, fps: number = DEFAULT_FPS): number {
  return Math.round(seconds * fps);
}

/**
 * Converts frame index to exact seconds.
 */
export function frameToSeconds(frameIndex: number, fps: number = DEFAULT_FPS): number {
  return frameIndex / fps;
}

/**
 * Checks if a given frame count N satisfies a general A*n + B chunking rule.
 */
export function isRuleValid(
  frameCount: number,
  rule: ChunkingRule = RULE_8N_PLUS_1
): { valid: boolean; n: number | null } {
  const minValid = Math.max(1, rule.offset);
  if (frameCount < minValid || rule.multiplier <= 0) {
    return { valid: false, n: null };
  }
  const rem = (frameCount - rule.offset) % rule.multiplier;
  if (rem === 0) {
    const n = Math.round((frameCount - rule.offset) / rule.multiplier);
    if (n >= 0) {
      return { valid: true, n };
    }
  }
  return { valid: false, n: null };
}

/**
 * Returns array of valid frame counts for a given rule within [minFrames, maxFrames].
 */
export function getValidRuleFrameCounts(
  rule: ChunkingRule = RULE_8N_PLUS_1,
  minFrames: number = 73,
  maxFrames: number = 1001
): number[] {
  if (rule.multiplier <= 0) return [];
  const validCounts: number[] = [];
  const startN = Math.max(0, Math.ceil((minFrames - rule.offset) / rule.multiplier));
  const endN = Math.floor((maxFrames - rule.offset) / rule.multiplier);

  for (let n = startN; n <= endN; n++) {
    validCounts.push(rule.multiplier * n + rule.offset);
  }
  return validCounts;
}

/**
 * Finds the nearest frame count that satisfies a given rule.
 */
export function getNearestRuleFrameCount(
  targetFrameCount: number,
  rule: ChunkingRule = RULE_8N_PLUS_1
): number {
  if (rule.multiplier <= 0) return Math.max(1, targetFrameCount);
  const n = Math.round((targetFrameCount - rule.offset) / rule.multiplier);
  const clampedN = Math.max(0, n);
  return rule.multiplier * clampedN + rule.offset;
}

/**
 * Given a target frame position relative to a start frame, snaps to the nearest valid rule offset.
 */
export function snapFrameToRule(
  startFrame: number,
  candidateTargetFrame: number,
  rule: ChunkingRule = RULE_8N_PLUS_1,
  minFrames: number = 73,
  maxFrames: number = 1001
): number {
  const rawOffset = candidateTargetFrame - startFrame;
  const validCounts = getValidRuleFrameCounts(rule, minFrames, maxFrames);

  if (validCounts.length === 0) {
    return startFrame + getNearestRuleFrameCount(rawOffset, rule);
  }

  let bestCount = validCounts[0];
  let minDiff = Math.abs(rawOffset - bestCount);

  for (const count of validCounts) {
    const diff = Math.abs(rawOffset - count);
    if (diff < minDiff) {
      minDiff = diff;
      bestCount = count;
    }
  }

  return startFrame + bestCount;
}

/**
 * Checks if a given frame count N satisfies the 8n+1 length condition.
 * Backward-compatible wrapper around isRuleValid.
 */
export function is8nPlus1(frameCount: number): { valid: boolean; n: number | null } {
  return isRuleValid(frameCount, RULE_8N_PLUS_1);
}

/**
 * Returns array of valid 8n+1 frame counts within [minFrames, maxFrames].
 * Backward-compatible wrapper around getValidRuleFrameCounts.
 */
export function getValid8nPlus1FrameCounts(minFrames: number = 73, maxFrames: number = 1001): number[] {
  return getValidRuleFrameCounts(RULE_8N_PLUS_1, minFrames, maxFrames);
}

/**
 * Finds the nearest frame count that satisfies 8n+1 relative to min/max constraints.
 * Backward-compatible wrapper around getNearestRuleFrameCount.
 */
export function getNearest8nPlus1FrameCount(targetFrameCount: number): number {
  return getNearestRuleFrameCount(targetFrameCount, RULE_8N_PLUS_1);
}

/**
 * Given a target frame position relative to a start frame, snaps to the nearest valid 8n+1 offset.
 * Backward-compatible wrapper around snapFrameToRule.
 */
export function snapFrameTo8nPlus1(
  startFrame: number,
  candidateTargetFrame: number,
  minFrames: number = 73,
  maxFrames: number = 1001
): number {
  return snapFrameToRule(startFrame, candidateTargetFrame, RULE_8N_PLUS_1, minFrames, maxFrames);
}

/**
 * Formats seconds into HH:MM:SS.mmm string
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  const padSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
  return `${mins}:${padSecs}`;
}

/**
 * Sanitizes base filename (removes extension)
 */
export function getBaseFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.substring(0, lastDot);
}
