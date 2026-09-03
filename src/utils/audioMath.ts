/**
 * Utility functions for 25 FPS sample-exact and frame-exact audio arithmetic.
 */

export const DEFAULT_FPS = 25;

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
 * Checks if a given frame count N satisfies the 8n+1 length condition.
 */
export function is8nPlus1(frameCount: number): { valid: boolean; n: number | null } {
  if (frameCount < 1) return { valid: false, n: null };
  const rem = (frameCount - 1) % 8;
  if (rem === 0) {
    return { valid: true, n: (frameCount - 1) / 8 };
  }
  return { valid: false, n: null };
}

/**
 * Returns array of valid 8n+1 frame counts within [minFrames, maxFrames].
 */
export function getValid8nPlus1FrameCounts(minFrames: number = 73, maxFrames: number = 1001): number[] {
  const validCounts: number[] = [];
  // 8n + 1 >= minFrames => 8n >= minFrames - 1 => n >= ceil((minFrames - 1)/8)
  const startN = Math.max(0, Math.ceil((minFrames - 1) / 8));
  const endN = Math.floor((maxFrames - 1) / 8);

  for (let n = startN; n <= endN; n++) {
    validCounts.push(8 * n + 1);
  }
  return validCounts;
}

/**
 * Finds the nearest frame count that satisfies 8n+1 relative to min/max constraints.
 */
export function getNearest8nPlus1FrameCount(targetFrameCount: number): number {
  const n = Math.round((targetFrameCount - 1) / 8);
  const clampedN = Math.max(0, n);
  return 8 * clampedN + 1;
}

/**
 * Given a target frame position relative to a start frame, snaps to the nearest valid 8n+1 offset.
 */
export function snapFrameTo8nPlus1(
  startFrame: number,
  candidateTargetFrame: number,
  minFrames: number = 73,
  maxFrames: number = 1001
): number {
  const rawOffset = candidateTargetFrame - startFrame;
  const validCounts = getValid8nPlus1FrameCounts(minFrames, maxFrames);
  
  if (validCounts.length === 0) {
    return startFrame + getNearest8nPlus1FrameCount(rawOffset);
  }

  // Find nearest valid count in range
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
