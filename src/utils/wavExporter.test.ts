import { describe, it, expect } from 'vitest';
import { audioBufferToWav, buildAudioSegments, generateFrameManifestText } from './wavExporter';
import { RULE_8N_PLUS_1 } from './audioMath';
import type { AudioSegment, SplitMarker } from '../types/audio';

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

function makeBuffer(channels: Float32Array<ArrayBuffer>[], sampleRate: number): AudioBufferStub {
  return {
    duration: channels[0].length / sampleRate,
    length: channels[0].length,
    numberOfChannels: channels.length,
    sampleRate,
    getChannelData: (channel: number) => channels[channel],
    copyFromChannel: () => undefined,
    copyToChannel: () => undefined,
  };
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

function markerAt(frameIndex: number, sampleRate: number, fps: number): SplitMarker {
  return {
    id: `m${frameIndex}`,
    timeSeconds: frameIndex / fps,
    sampleIndex: Math.round(frameIndex * (sampleRate / fps)),
    frameIndex,
    isAutoDetected: true,
    isUserOverridden: false,
  };
}

// 100 frames @ 25 FPS / 48 kHz, constant 0.5 amplitude -> every segment -6 dB.
function buildFixtureSegments(): AudioSegment[] {
  const samples = new Float32Array(100 * 1920).fill(0.5);
  const buffer = makeBuffer([samples], 48000);
  const markers = [markerAt(9, 48000, 25), markerAt(90, 48000, 25)];
  return buildAudioSegments(buffer, markers, 'take.wav', 25, RULE_8N_PLUS_1);
}

describe('audioBufferToWav (16-bit PCM encoder)', () => {
  const STEREO = makeBuffer(
    [
      new Float32Array([0, 0.5, -0.5, 1.0]),
      new Float32Array([0, -1.0, 1.0, 0.25]),
    ],
    48000
  );

  it('emits an exact RIFF/PCM header', () => {
    const wav = audioBufferToWav(STEREO, 0, 4);
    const view = new DataView(wav);

    expect(wav.byteLength).toBe(60); // 44-byte header + 4 samples * 2ch * 2B
    expect(readAscii(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(52); // 36 + data size
    expect(readAscii(view, 8, 4)).toBe('WAVE');
    expect(readAscii(view, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // PCM subchunk1 size
    expect(view.getUint16(20, true)).toBe(1); // audio format = PCM
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(48000); // sample rate
    expect(view.getUint32(28, true)).toBe(192000); // byte rate
    expect(view.getUint16(32, true)).toBe(4); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(readAscii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(16); // data size
  });

  it('encodes interleaved samples with clamp and asymmetric scaling', () => {
    const view = new DataView(audioBufferToWav(STEREO, 0, 4));
    // 0 -> 0; 0.5 -> trunc(0.5*32767); -0.5 -> -0.5*32768; 1 -> 32767;
    // -1 -> -32768; 0.25 -> trunc(0.25*32767)
    const expected = [0, 0, 16383, -32768, -16384, 32767, 32767, 8191];
    expected.forEach((value, i) => {
      expect(view.getInt16(44 + i * 2, true)).toBe(value);
    });
  });

  it('slices an exact sub-range [startSample, endSample)', () => {
    const wav = audioBufferToWav(STEREO, 1, 3);
    expect(wav.byteLength).toBe(52); // 44 + 2 samples * 2ch * 2B
    const view = new DataView(wav);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44, true)).toBe(16383); // ch0[1] = 0.5
    expect(view.getInt16(46, true)).toBe(-32768); // ch1[1] = -1
    expect(view.getInt16(48, true)).toBe(-16384); // ch0[2] = -0.5
    expect(view.getInt16(50, true)).toBe(32767); // ch1[2] = 1
  });
});

describe('buildAudioSegments', () => {
  it('slices at markers, names files, and labels rule validity', () => {
    const segments = buildFixtureSegments();

    expect(segments.map((s) => s.filename)).toEqual([
      'take_0001.wav',
      'take_0002.wav',
      'take_0003.wav',
    ]);
    expect(segments[0]).toMatchObject({
      index: 1,
      startSample: 0,
      endSample: 17280,
      frameCount: 9,
      isValidRule: true,
      nValue: 1,
      ruleLabel: '8n+1 (n=1)',
      rmsLevelDb: -6,
    });
    expect(segments[1]).toMatchObject({
      startSample: 17280,
      endSample: 172800,
      frameCount: 81,
      isValidRule: true,
      nValue: 10,
    });
    // Trailing segment (90 -> 100 frames) legitimately violates the rule.
    expect(segments[2]).toMatchObject({
      startSample: 172800,
      endSample: 192000,
      frameCount: 10,
      isValidRule: false,
    });
    expect(segments[2].ruleLabel).toBe('Non-8n+1');
    expect(segments[0].durationSeconds).toBeCloseTo(0.36, 10);
    expect(segments[0].endTime).toBeCloseTo(0.36, 10);
  });
});

describe('generateFrameManifestText', () => {
  it('includes header info, per-segment lines, and raw frame counts', () => {
    const text = generateFrameManifestText(buildFixtureSegments(), 'take.wav', 25, '8n+1');
    expect(text).toContain('# Total Segments: 3');
    expect(text).toContain('take_0001.wav: 9 frames (0.360s, 8n+1 (n=1))');
    expect(text.endsWith('9\n81\n10')).toBe(true);
  });
});
