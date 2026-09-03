import JSZip from 'jszip';
import { AudioSegment, SplitMarker } from '../types/audio';
import {
  DEFAULT_FPS,
  getBaseFilename,
  is8nPlus1,
  sampleToFrame,
} from './audioMath';

/**
 * Builds array of AudioSegment data structures from AudioBuffer and split markers.
 */
export function buildAudioSegments(
  audioBuffer: AudioBuffer,
  markers: SplitMarker[],
  originalFilename: string,
  fps: number = DEFAULT_FPS
): AudioSegment[] {
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const baseName = getBaseFilename(originalFilename);

  // Sort markers by time/sample
  const sortedMarkers = [...markers].sort((a, b) => a.sampleIndex - b.sampleIndex);

  // Build slice sample boundaries: [0, marker1, marker2, ..., totalSamples]
  const sampleBounds: number[] = [0];
  sortedMarkers.forEach((m) => {
    if (m.sampleIndex > 0 && m.sampleIndex < totalSamples) {
      sampleBounds.push(m.sampleIndex);
    }
  });
  sampleBounds.push(totalSamples);

  const segments: AudioSegment[] = [];
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < sampleBounds.length - 1; i++) {
    const startSample = sampleBounds[i];
    const endSample = sampleBounds[i + 1];
    const sampleCount = endSample - startSample;
    const durationSeconds = sampleCount / sampleRate;

    const startFrame = sampleToFrame(startSample, sampleRate, fps);
    const endFrame = sampleToFrame(endSample, sampleRate, fps);
    const frameCount = endFrame - startFrame;

    const check8n = is8nPlus1(frameCount);

    // Calculate segment RMS dB
    let sumSquare = 0;
    const step = Math.max(1, Math.floor(sampleCount / 2000)); // subsample for performance
    let sampleCountProcessed = 0;
    for (let s = startSample; s < endSample; s += step) {
      const val = channelData[s];
      sumSquare += val * val;
      sampleCountProcessed++;
    }
    const rms = Math.sqrt(sumSquare / (sampleCountProcessed || 1));
    const rmsDb = Math.round(20 * Math.log10(Math.max(rms, 1e-6)));

    // Format index as _0001.wav, _0002.wav, etc.
    const indexStr = (i + 1).toString().padStart(4, '0');
    const filename = `${baseName}_${indexStr}.wav`;

    segments.push({
      index: i + 1,
      filename,
      startTime: startSample / sampleRate,
      endTime: endSample / sampleRate,
      startSample,
      endSample,
      durationSeconds,
      frameCount,
      is8nPlus1: check8n.valid,
      nValue: check8n.n,
      rmsLevelDb: rmsDb,
    });
  }

  return segments;
}

/**
 * Generates a formatted text file content containing the list of segments and frame lengths.
 */
export function generateFrameManifestText(segments: AudioSegment[], originalFilename: string): string {
  const lines: string[] = [];
  lines.push(`# 25 FPS Audio Segment Frame Length Manifest`);
  lines.push(`# Original File: ${originalFilename}`);
  lines.push(`# Total Segments: ${segments.length}`);
  lines.push(`# Format: [Filename] -> [Frames at 25 FPS] (Duration, 8n+1 Status)`);
  lines.push(``);

  segments.forEach((seg) => {
    const statusStr = seg.is8nPlus1 ? `8n+1 (n=${seg.nValue})` : `Non-8n+1`;
    lines.push(`${seg.filename}: ${seg.frameCount} frames (${seg.durationSeconds.toFixed(3)}s, ${statusStr})`);
  });

  lines.push(``);
  lines.push(`# Raw Frame Counts (one integer per line):`);
  segments.forEach((seg) => {
    lines.push(`${seg.frameCount}`);
  });

  return lines.join('\n');
}

/**
 * Encodes audio buffer segment (Float32Array) to a 16-bit PCM WAV File ArrayBuffer.
 */
export function audioBufferToWav(audioBuffer: AudioBuffer, startSample: number, endSample: number): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = endSample - startSample;

  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write string to DataView
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  /* fmt sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  /* data sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  let offset = 44;
  for (let s = startSample; s < endSample; s++) {
    for (let ch = 0; ch < numChannels; ch++) {
      // Clamp sample to [-1.0, 1.0]
      const sample = Math.max(-1, Math.min(1, channels[ch][s]));
      // Scale to 16-bit signed integer [-32768, 32767]
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return buffer;
}

type SaveFilter = { name: string; extensions: string[] };

/**
 * True when the app runs inside the Tauri desktop shell (WKWebView).
 * Blob-anchor downloads are unreliable there, so exports use the native
 * save panel + filesystem plugins instead.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Persists a Blob to disk. Inside Tauri this opens the native macOS save panel
 * and resolves with the chosen absolute path (null if cancelled). In the browser
 * it falls back to the anchor-download pattern and resolves with null.
 */
async function saveBlob(
  blob: Blob,
  filename: string,
  filters: SaveFilter[]
): Promise<string | null> {
  if (isTauriRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({ defaultPath: filename, filters });
    if (!path) return null;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return path;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
}

/**
 * Downloads a single AudioSegment as a WAV file.
 */
export function downloadSegmentAsWav(audioBuffer: AudioBuffer, segment: AudioSegment) {
  const wavBuffer = audioBufferToWav(audioBuffer, segment.startSample, segment.endSample);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  void saveBlob(blob, segment.filename, [{ name: 'WAV Audio', extensions: ['wav'] }]);
}

/**
 * Downloads just the text file manifest of segment frame lengths.
 */
export function downloadFrameManifestTxt(segments: AudioSegment[], originalFilename: string) {
  const baseName = getBaseFilename(originalFilename);
  const textContent = generateFrameManifestText(segments, originalFilename);
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  void saveBlob(blob, `${baseName}_frame_lengths.txt`, [
    { name: 'Text File', extensions: ['txt'] },
  ]);
}

/**
 * Packs all audio segments AND the frame lengths text file into a ZIP archive and triggers browser download.
 */
export async function downloadAllSegmentsAsZip(
  audioBuffer: AudioBuffer,
  segments: AudioSegment[],
  originalFilename: string,
  onProgress?: (percent: number) => void
) {
  const zip = new JSZip();
  const baseName = getBaseFilename(originalFilename);

  // 1. Add all WAV segment files
  const total = segments.length;
  for (let i = 0; i < total; i++) {
    const seg = segments[i];
    const wavBuffer = audioBufferToWav(audioBuffer, seg.startSample, seg.endSample);
    zip.file(seg.filename, wavBuffer);

    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 50));
    }
  }

  // 2. Add text file manifest of frame lengths
  const textContent = generateFrameManifestText(segments, originalFilename);
  zip.file(`${baseName}_frame_lengths.txt`, textContent);

  // 3. Generate ZIP archive
  const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(50 + Math.round(metadata.percent * 0.5));
    }
  });

  // In the desktop app the ZIP save panel already established the target
  // directory, so write the manifest next to it without a second dialog.
  const zipFilename = `${baseName}_25fps_8n1_split.zip`;
  const zipFilters: SaveFilter[] = [{ name: 'ZIP Archive', extensions: ['zip'] }];
  const chosenPath = await saveBlob(content, zipFilename, zipFilters);

  if (chosenPath) {
    const textContent = generateFrameManifestText(segments, originalFilename);
    const manifestBlob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const dir = chosenPath.replace(/[^/]*$/, '');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(`${dir}${baseName}_frame_lengths.txt`, new Uint8Array(await manifestBlob.arrayBuffer()));
  } else if (!isTauriRuntime()) {
    // Also trigger individual direct download of the .txt file for convenience
    downloadFrameManifestTxt(segments, originalFilename);
  }
}
