import { describe, it, expect } from 'vitest';
import { detectSplitPoints } from './silenceDetector';
import { RULE_8N_PLUS_1, frameToSample, getValidRuleFrameCounts } from './audioMath';
import type { SplitSettings } from '../types/audio';

const FPS = 25;
const SR = 48000;
const SPF = SR / FPS; // 1920 samples per frame

// Structural AudioBuffer stub (no DOM runtime needed in Node).
interface AudioBufferStub {
  duration: number;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array<ArrayBuffer>;
  copyFromChannel(destination: Float32Array, channelNumber: number, bufferOffset?: number): void;
  copyToChannel(source: Float32Array, channelNumber: number, bufferOffset?: number): void;
}

function makeBuffer(samples: Float32Array<ArrayBuffer>, sampleRate = SR): AudioBufferStub {
  return {
    duration: samples.length / sampleRate,
    length: samples.length,
    numberOfChannels: 1,
    sampleRate,
    getChannelData: () => samples,
    copyFromChannel: () => undefined,
    copyToChannel: () => undefined,
  };
}

function makeSettings(): SplitSettings {
  return {
    fps: FPS,
    rule: RULE_8N_PLUS_1,
    minFrames: 73,
    maxFrames: 177,
    silenceThresholdDb: -35,
    strictlySnapToGrid: true,
  };
}

// Loud speech-like bursts separated by silent gaps (given in frames).
function makeSignal(totalFrames: number, loudRanges: Array<[number, number]>): Float32Array<ArrayBuffer> {
  const data = new Float32Array(totalFrames * SPF);
  for (const [f0, f1] of loudRanges) {
    for (let f = f0; f < f1; f++) {
      for (let s = 0; s < SPF; s++) {
        const i = f * SPF + s;
        data[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR);
      }
    }
  }
  return data;
}

function expectRuleValidPath(markers: ReturnType<typeof detectSplitPoints>) {
  // Every DP-path segment (start -> m1 -> m2 -> ...) must satisfy 8n+1.
  // The trailing segment (last marker -> end of audio) may legitimately
  // deviate via detectSplitPoints' documented end-of-audio fallback.
  const valid = new Set(getValidRuleFrameCounts(RULE_8N_PLUS_1, 73, 177));
  const bounds = [0, ...markers.map((m) => m.frameIndex)];
  for (let i = 1; i < bounds.length; i++) {
    expect(valid.has(bounds[i] - bounds[i - 1])).toBe(true);
  }
}

describe('detectSplitPoints (real DP silence detection)', () => {
  const TOTAL_FRAMES = 500;
  const signal = makeSignal(TOTAL_FRAMES, [
    [0, 141],   // phrase 1, then ~15 silent frames
    [156, 331], // phrase 2, then ~15 silent frames
    [346, 500], // phrase 3 to the end
  ]);

  it('produces a sample-exact, rule-valid segmentation on speech-like audio', () => {
    const markers = detectSplitPoints(makeBuffer(signal), makeSettings());
    expect(markers.length).toBeGreaterThanOrEqual(1);

    let prev = 0;
    for (const m of markers) {
      expect(Number.isInteger(m.frameIndex)).toBe(true);
      expect(m.frameIndex).toBeGreaterThan(prev);
      expect(m.frameIndex).toBeLessThan(TOTAL_FRAMES);
      expect(m.sampleIndex).toBe(frameToSample(m.frameIndex, SR, FPS));
      expect(m.timeSeconds).toBeCloseTo(m.frameIndex / FPS, 10);
      prev = m.frameIndex;
    }

    expectRuleValidPath(markers);
  });

  it('keeps every segment rule-valid on constant silence', () => {
    const silence = new Float32Array(TOTAL_FRAMES * SPF);
    const markers = detectSplitPoints(makeBuffer(silence), makeSettings());
    expect(markers.length).toBeGreaterThanOrEqual(1);
    expectRuleValidPath(markers);
  });

  it('returns no markers for audio shorter than minFrames', () => {
    const short = makeSignal(50, [[0, 50]]);
    expect(detectSplitPoints(makeBuffer(short), makeSettings())).toEqual([]);
  });
});
