/**
 * Mathematical unit tests for AudioSplitter.
 * Validates frame arithmetic, 8n+1, 17n+5, arbitrary An+B rules, and DP solver.
 */

import assert from 'node:assert';

// Test math directly using pure JS equivalents of audioMath functions
const RULE_8N_PLUS_1 = { multiplier: 8, offset: 1, name: '8n+1' };
const RULE_17N_PLUS_5 = { multiplier: 17, offset: 5, name: '17n+5' };

function getSamplesPerFrame(sampleRate, fps = 25) {
  return sampleRate / fps;
}

function frameToSample(frameIndex, sampleRate, fps = 25) {
  return Math.round(frameIndex * getSamplesPerFrame(sampleRate, fps));
}

function sampleToFrame(sampleIndex, sampleRate, fps = 25) {
  return Math.round(sampleIndex / getSamplesPerFrame(sampleRate, fps));
}

function isRuleValid(frameCount, rule = RULE_8N_PLUS_1) {
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

function getValidRuleFrameCounts(rule = RULE_8N_PLUS_1, minFrames = 73, maxFrames = 1001) {
  if (rule.multiplier <= 0) return [];
  const validCounts = [];
  const startN = Math.max(0, Math.ceil((minFrames - rule.offset) / rule.multiplier));
  const endN = Math.floor((maxFrames - rule.offset) / rule.multiplier);

  for (let n = startN; n <= endN; n++) {
    validCounts.push(rule.multiplier * n + rule.offset);
  }
  return validCounts;
}

function getNearestRuleFrameCount(targetFrameCount, rule = RULE_8N_PLUS_1) {
  if (rule.multiplier <= 0) return Math.max(1, targetFrameCount);
  const n = Math.round((targetFrameCount - rule.offset) / rule.multiplier);
  const clampedN = Math.max(0, n);
  return rule.multiplier * clampedN + rule.offset;
}

function snapFrameToRule(startFrame, candidateTargetFrame, rule = RULE_8N_PLUS_1, minFrames = 73, maxFrames = 1001) {
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

console.log('--- Running Audio Math & Frame Invariant Verification ---');

// 1. Frame Duration & Samples Per Frame Tests
console.log('1. Testing Samples Per Frame & Conversion Math...');
assert.strictEqual(getSamplesPerFrame(44100, 25), 1764);
assert.strictEqual(getSamplesPerFrame(48000, 25), 1920);
assert.strictEqual(getSamplesPerFrame(48000, 24), 2000);
assert.strictEqual(getSamplesPerFrame(44100, 24), 1837.5);

// Round-trip frame conversion
for (let f = 0; f < 1000; f += 25) {
  const s25 = frameToSample(f, 44100, 25);
  assert.strictEqual(sampleToFrame(s25, 44100, 25), f);

  const s24 = frameToSample(f, 48000, 24);
  assert.strictEqual(sampleToFrame(s24, 48000, 24), f);
}
console.log('   ✓ Samples per frame and roundtrip conversions passed.');

// 2. 8n+1 Rule Validation
console.log('2. Testing 8n+1 Rule Math...');
assert.deepStrictEqual(isRuleValid(1, RULE_8N_PLUS_1), { valid: true, n: 0 });
assert.deepStrictEqual(isRuleValid(9, RULE_8N_PLUS_1), { valid: true, n: 1 });
assert.deepStrictEqual(isRuleValid(73, RULE_8N_PLUS_1), { valid: true, n: 9 });
assert.deepStrictEqual(isRuleValid(177, RULE_8N_PLUS_1), { valid: true, n: 22 });
assert.strictEqual(isRuleValid(72, RULE_8N_PLUS_1).valid, false);
assert.strictEqual(isRuleValid(74, RULE_8N_PLUS_1).valid, false);
assert.strictEqual(isRuleValid(0, RULE_8N_PLUS_1).valid, false);

const valid8n1 = getValidRuleFrameCounts(RULE_8N_PLUS_1, 73, 177);
assert.strictEqual(valid8n1[0], 73);
assert.strictEqual(valid8n1[valid8n1.length - 1], 177);
valid8n1.forEach((c) => {
  assert.strictEqual((c - 1) % 8, 0);
});
console.log('   ✓ 8n+1 rule passed.');

// 3. 17n+5 Rule Validation
console.log('3. Testing 17n+5 Rule Math (24 FPS Preset)...');
assert.deepStrictEqual(isRuleValid(5, RULE_17N_PLUS_5), { valid: true, n: 0 });
assert.deepStrictEqual(isRuleValid(22, RULE_17N_PLUS_5), { valid: true, n: 1 });
assert.deepStrictEqual(isRuleValid(39, RULE_17N_PLUS_5), { valid: true, n: 2 });
assert.deepStrictEqual(isRuleValid(56, RULE_17N_PLUS_5), { valid: true, n: 3 });
assert.deepStrictEqual(isRuleValid(73, RULE_17N_PLUS_5), { valid: true, n: 4 }); // 17*4 + 5 = 68 + 5 = 73
assert.deepStrictEqual(isRuleValid(90, RULE_17N_PLUS_5), { valid: true, n: 5 });
assert.deepStrictEqual(isRuleValid(107, RULE_17N_PLUS_5), { valid: true, n: 6 });
assert.deepStrictEqual(isRuleValid(124, RULE_17N_PLUS_5), { valid: true, n: 7 });
assert.deepStrictEqual(isRuleValid(141, RULE_17N_PLUS_5), { valid: true, n: 8 });
assert.deepStrictEqual(isRuleValid(158, RULE_17N_PLUS_5), { valid: true, n: 9 });
assert.deepStrictEqual(isRuleValid(175, RULE_17N_PLUS_5), { valid: true, n: 10 }); // 17*10 + 5 = 175

assert.strictEqual(isRuleValid(4, RULE_17N_PLUS_5).valid, false);
assert.strictEqual(isRuleValid(20, RULE_17N_PLUS_5).valid, false);
assert.strictEqual(isRuleValid(72, RULE_17N_PLUS_5).valid, false);
assert.strictEqual(isRuleValid(74, RULE_17N_PLUS_5).valid, false);

const valid17n5 = getValidRuleFrameCounts(RULE_17N_PLUS_5, 73, 175);
assert.deepStrictEqual(valid17n5, [73, 90, 107, 124, 141, 158, 175]);
console.log('   ✓ 17n+5 rule and frame sequence passed.');

// 4. Snapping tests
console.log('4. Testing Marker Snapping Logic...');
// Snapping to 17n+5
const snapped1 = snapFrameToRule(0, 70, RULE_17N_PLUS_5, 73, 175);
assert.strictEqual(snapped1, 73);

const snapped2 = snapFrameToRule(100, 192, RULE_17N_PLUS_5, 73, 175); // delta 92 -> nearest in [73, 90, 107...] is 90
assert.strictEqual(snapped2, 100 + 90);

const snapped3 = snapFrameToRule(0, 200, RULE_17N_PLUS_5, 73, 175); // clamped to max 175
assert.strictEqual(snapped3, 175);
console.log('   ✓ Marker snapping passed.');

// 5. Arbitrary User-Entered Rule Math
console.log('5. Testing Arbitrary User-Entered Rules...');
const customRule1 = { multiplier: 12, offset: 0, name: '12n' };
assert.deepStrictEqual(isRuleValid(24, customRule1), { valid: true, n: 2 });
assert.deepStrictEqual(isRuleValid(25, customRule1), { valid: false, n: null });

const customRule2 = { multiplier: 10, offset: 3, name: '10n+3' };
assert.deepStrictEqual(isRuleValid(43, customRule2), { valid: true, n: 4 });
assert.deepStrictEqual(isRuleValid(50, customRule2), { valid: false, n: null });
console.log('   ✓ Arbitrary user rules passed.');

// 6. DP Pathfinding Simulation for 17n+5 at 24 FPS
console.log('6. Testing DP Silence Splitting with 17n+5 at 24 FPS...');
const totalFrames = 500;
const validLengths = getValidRuleFrameCounts(RULE_17N_PLUS_5, 73, 175);
const INF = 1e12;
const dp = new Float32Array(totalFrames + 1).fill(INF);
const parent = new Int32Array(totalFrames + 1).fill(-1);
dp[0] = 0;

for (let f = 1; f <= totalFrames; f++) {
  let minCost = INF;
  let bestPrev = -1;
  for (const len of validLengths) {
    const prev = f - len;
    if (prev < 0 || dp[prev] >= INF) continue;
    const cost = dp[prev] + 1;
    if (cost < minCost) {
      minCost = cost;
      bestPrev = prev;
    }
  }
  if (bestPrev !== -1) {
    dp[f] = minCost;
    parent[f] = bestPrev;
  }
}

// Check backtrack reconstruction
let curr = totalFrames;
while (curr > 0 && dp[curr] >= INF) {
  curr--;
}
const splits = [];
while (curr > 0 && parent[curr] !== -1) {
  splits.push({ start: parent[curr], end: curr, len: curr - parent[curr] });
  curr = parent[curr];
}

assert(splits.length > 0, 'Should find valid split sequence');
splits.forEach((s) => {
  const check = isRuleValid(s.len, RULE_17N_PLUS_5);
  assert(check.valid, `Segment length ${s.len} must satisfy 17n+5`);
});
console.log(`   ✓ DP pathfinding produced ${splits.length} valid 17n+5 segments.`);

console.log('\n========================================');
console.log('ALL AUDIO INVARIANT & RULE TESTS PASSED!');
console.log('========================================');
