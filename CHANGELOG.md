# Changelog

All notable changes to the **AudioSplitter (25 FPS 8n+1)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2026-09-15

### Added
- **CI Pipeline**: GitHub Actions workflow running type-check, lint, tests, and dependency audit on every push and pull request.
- **ESLint**: Flat ESLint 10 configuration (typescript-eslint + react-hooks) with strict unused-symbol checks (`npm run lint`).
- **Large Export Guard**: Batch ZIP exports estimated above ~1 GB of WAV data ask for confirmation before being built in memory.

### Changed
- **Waveform Zoom Fixed**: Zoom now genuinely magnifies the waveform with horizontal scrolling; the canvas backing store is devicePixelRatio-aware for crisp Retina rendering.
- **Playback Performance**: The static waveform layer (grid, peaks, segments, markers) is cached offscreen; playhead updates during playback are O(1) instead of resampling the entire buffer every frame.
- **Toast Notifications**: Audio decode and export failures now surface as in-app toasts instead of blocking `alert()` dialogs.
- **Security Hardening**: Production Content-Security-Policy enabled in `tauri.conf.json` (previously `null`).
- **Dependency Refresh**: All dependencies updated to the latest in-range releases.

### Removed
- **Legacy Setting**: `strictlySnapTo8n1` compatibility alias removed in favor of `strictlySnapToGrid`.

### Fixed
- **Documentation**: README frame-range example corrected to the actual 73–177 frame defaults.

---

## [1.2.0] - 2026-09-03

### Changed
- **Increased Maximum Segment Length**: Expanded the maximum segment size limit up to 1000 frames ($1001$ frames $\approx 40.04 \text{ seconds}$) in 25 FPS $8n+1$ frame calculations, Dynamic Programming silence detection, snapping engine, and UI controls.

---

## [1.1.0] - 2026-09-02

### Added
- **Frame Length Text File Manifest Export**:
  - Implemented `generateFrameManifestText` to format segment filenames and frame counts into human-readable and script-parsable text format.
  - Automatically includes `[origfilename]_frame_lengths.txt` in the exported `.zip` archive upon clicking **Export All**.
  - Added dedicated **Export Frame Lengths (.txt)** button in `ControlPanel` for standalone text manifest downloads.

---

## [1.0.0] - 2026-09-02

### Added
- **Core 25 FPS 8n+1 Audio Math Engine**:
  - Sample-exact sample rate conversion for 44.1 kHz ($1,764$ samples/frame), 48 kHz ($1,920$ samples/frame), and custom sample rates.
  - $N = 8n + 1$ frame count validator and range filter for 3–7s target segment lengths.
  - Nearest $8n+1$ grid snapping algorithm.
- **Dynamic Programming Silence Detection**:
  - Per-frame 25 FPS RMS energy calculator.
  - Dynamic programming split search algorithm to place segment boundaries at silence / volume minima.
- **Interactive Canvas Waveform Editor**:
  - Canvas waveform renderer with zoom controls (100% to 500%), time ruler, and playhead indicator.
  - Interactive split markers with drag-and-drop handles and live $8n+1$ snapping.
  - Double-click to insert split markers; select & delete marker controls.
  - Color-coded segment background tinting (green for valid $8n+1$, red warning for non-$8n+1$).
- **Segment Table & Data View**:
  - Displays segment index, formatted filename (`[origfilename]_0001.wav`), time range, frame count, $8n+1$ status badge, and average dB level.
  - Individual segment audio preview button and single WAV download button.
- **Export System**:
  - Client-side 16-bit PCM WAV file encoder.
  - JSZip compression for single-click batch download of all split segments.
- **Demo Mode**:
  - Built-in synthesized audio generator with speech-like tones and silence pauses for immediate testing without uploading files.
- **Documentation**:
  - Comprehensive `README.md`, `CHANGELOG.md`, and `AGENTS.md` guidelines.
