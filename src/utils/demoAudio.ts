/**
 * Synthesizes a demo AudioBuffer with alternating tone patterns and silence gaps
 * so users can test silence detection and 25 FPS 8n+1 splitting instantly.
 */
export function generateDemoAudioBuffer(audioCtx: AudioContext): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const durationSec = 22; // 22 seconds total (~550 frames at 25 fps)
  const totalSamples = Math.floor(sampleRate * durationSec);

  const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Generate speech/music bursts separated by ~0.4s to ~1s silence gaps
  // Phrase durations around 3.5s, 4.8s, 5.2s, 4.0s
  const phrases = [
    { startSec: 0.2, endSec: 3.8, freq: 220 },   // Phrase 1 (~3.6s)
    { startSec: 4.4, endSec: 9.0, freq: 330 },   // Phrase 2 (~4.6s)
    { startSec: 9.8, endSec: 14.8, freq: 277 },  // Phrase 3 (~5.0s)
    { startSec: 15.4, endSec: 21.0, freq: 370 }, // Phrase 4 (~5.6s)
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const phrase of phrases) {
      if (t >= phrase.startSec && t <= phrase.endSec) {
        // Fade in / fade out envelope
        const fadeIn = Math.min(1, (t - phrase.startSec) / 0.05);
        const fadeOut = Math.min(1, (phrase.endSec - t) / 0.05);
        const env = fadeIn * fadeOut;

        // Rich harmonic tone + amplitude modulation (speech-like)
        const mod = 0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t);
        const tone1 = Math.sin(2 * Math.PI * phrase.freq * t);
        const tone2 = 0.5 * Math.sin(2 * Math.PI * phrase.freq * 1.5 * t);
        const noise = (Math.random() - 0.5) * 0.05;

        sample = env * mod * 0.3 * (tone1 + tone2 + noise);
        break;
      }
    }

    data[i] = sample;
  }

  return buffer;
}
