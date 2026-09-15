import { describe, it, expect } from 'vitest';
import {
  RULE_8N_PLUS_1,
  RULE_17N_PLUS_5,
  getSamplesPerFrame,
  frameToSample,
  sampleToFrame,
  isRuleValid,
  getValidRuleFrameCounts,
  snapFrameToRule,
} from './audioMath';

// These tests import the REAL modules under src/utils — the suite must fail
// if the shipped math regresses, unlike the former test_runner.js which
// validated duplicated inline copies.

describe('samples per frame & conversion math', () => {
  it('computes exact samples per frame', () => {
    expect(getSamplesPerFrame(44100, 25)).toBe(1764);
    expect(getSamplesPerFrame(48000, 25)).toBe(1920);
    expect(getSamplesPerFrame(48000, 24)).toBe(2000);
    expect(getSamplesPerFrame(44100, 24)).toBe(1837.5);
  });

  it('round-trips frame -> sample -> frame without drift', () => {
    for (let f = 0; f < 1000; f += 25) {
      expect(sampleToFrame(frameToSample(f, 44100, 25), 44100, 25)).toBe(f);
      expect(sampleToFrame(frameToSample(f, 48000, 24), 48000, 24)).toBe(f);
    }
  });
});

describe('8n+1 rule validation', () => {
  it('accepts valid frame counts with correct n', () => {
    expect(isRuleValid(1, RULE_8N_PLUS_1)).toEqual({ valid: true, n: 0 });
    expect(isRuleValid(9, RULE_8N_PLUS_1)).toEqual({ valid: true, n: 1 });
    expect(isRuleValid(73, RULE_8N_PLUS_1)).toEqual({ valid: true, n: 9 });
    expect(isRuleValid(177, RULE_8N_PLUS_1)).toEqual({ valid: true, n: 22 });
  });

  it('rejects invalid frame counts', () => {
    expect(isRuleValid(72, RULE_8N_PLUS_1).valid).toBe(false);
    expect(isRuleValid(74, RULE_8N_PLUS_1).valid).toBe(false);
    expect(isRuleValid(0, RULE_8N_PLUS_1).valid).toBe(false);
  });

  it('lists valid counts in range [73, 177]', () => {
    const counts = getValidRuleFrameCounts(RULE_8N_PLUS_1, 73, 177);
    expect(counts[0]).toBe(73);
    expect(counts[counts.length - 1]).toBe(177);
    counts.forEach((c) => expect((c - 1) % 8).toBe(0));
  });
});

describe('17n+5 rule (24 FPS preset)', () => {
  it('accepts valid frame counts with correct n', () => {
    const expected: Array<[number, number]> = [
      [5, 0], [22, 1], [39, 2], [56, 3], [73, 4], [90, 5],
      [107, 6], [124, 7], [141, 8], [158, 9], [175, 10],
    ];
    expected.forEach(([frames, n]) =>
      expect(isRuleValid(frames, RULE_17N_PLUS_5)).toEqual({ valid: true, n })
    );
  });

  it('rejects invalid frame counts', () => {
    [4, 20, 72, 74].forEach((frames) =>
      expect(isRuleValid(frames, RULE_17N_PLUS_5).valid).toBe(false)
    );
  });

  it('lists the exact valid sequence in [73, 175]', () => {
    expect(getValidRuleFrameCounts(RULE_17N_PLUS_5, 73, 175)).toEqual([
      73, 90, 107, 124, 141, 158, 175,
    ]);
  });
});

describe('marker snapping', () => {
  it('snaps to the nearest valid offset relative to the start frame', () => {
    expect(snapFrameToRule(0, 70, RULE_17N_PLUS_5, 73, 175)).toBe(73);
    // delta 92 -> nearest valid length is 90
    expect(snapFrameToRule(100, 192, RULE_17N_PLUS_5, 73, 175)).toBe(190);
    // clamped to max segment length
    expect(snapFrameToRule(0, 200, RULE_17N_PLUS_5, 73, 175)).toBe(175);
  });
});

describe('arbitrary user-entered rules', () => {
  it('validates 12n', () => {
    const rule = { multiplier: 12, offset: 0, name: '12n' };
    expect(isRuleValid(24, rule)).toEqual({ valid: true, n: 2 });
    expect(isRuleValid(25, rule).valid).toBe(false);
  });

  it('validates 10n+3', () => {
    const rule = { multiplier: 10, offset: 3, name: '10n+3' };
    expect(isRuleValid(43, rule)).toEqual({ valid: true, n: 4 });
    expect(isRuleValid(50, rule).valid).toBe(false);
  });
});
