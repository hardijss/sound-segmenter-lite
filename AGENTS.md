# AGENTS.md - Agent Behavior & Repository Guidelines

This document establishes operational principles, architectural rules, and coding standards for AI coding agents (Antigravity, Claude, Copilot, etc.) working on the **AudioSplitter (25 FPS 8n+1)** repository.

---

## 🚀 1. Core Principles & Behavior Standards

1. **Strict Invariant Maintenance**:
   - Never alter or bypass the 25 FPS $8n+1$ mathematical frame formulas without explicit instructions.
   - Always ensure audio sample index calculations account for sample rate ($F_s$) and frame rate ($FPS = 25$).

2. **Empirical Verification Required**:
   - **Never declare success** after making code changes without compiling and verifying.
   - Always execute `npm run build` to confirm zero TypeScript compilation errors.
   - Run verification scripts (e.g. `node test_runner.js`) to validate frame arithmetic and silence detection logic before finishing a task.

3. **No Symptom Swallowing**:
   - If an audio decoding, export, or rendering step fails, diagnose the underlying cause (e.g. invalid sample buffer range or DataView offset). Never wrap missing data in empty try/catch blocks or return blank array buffers.

4. **Preserve API & Component Contracts**:
   - When updating utility signatures in `audioMath.ts`, `silenceDetector.ts`, or `wavExporter.ts`, audit all caller sites in `App.tsx`, `WaveformViewer.tsx`, `ControlPanel.tsx`, and `SegmentList.tsx`.

---

## 📐 2. Mathematical Invariants & Formula Reference

### Audio Frame Math (`src/utils/audioMath.ts`)

- **Frame Duration**:
  $$T_{\text{frame}} = \frac{1}{25} = 0.04 \text{ seconds}$$

- **Samples Per Frame**:
  $$S_{\text{frame}} = \frac{F_s}{25}$$
  - $F_s = 44100 \implies S_{\text{frame}} = 1764$
  - $F_s = 48000 \implies S_{\text{frame}} = 1920$

- **$8n+1$ Length Rule**:
  - A segment frame count $N$ is valid if and only if:
    $$(N - 1) \bmod 8 == 0 \quad \text{and} \quad N \ge 1$$
  - Integer $n = (N - 1) / 8$.

- **Snapping Offset**:
  - When a user moves marker $M_k$ relative to $M_{k-1}$, the relative delta frame count $\Delta f = f_k - f_{k-1}$ must be snapped to the nearest valid $8n+1$ count:
    $$n = \text{round}\left(\frac{\Delta f - 1}{8}\right), \quad \Delta f_{\text{snapped}} = 8n + 1$$

---

## 📂 3. Component & Directory Architecture

```
src/
├── types/
│   └── audio.ts          # Core data models: SplitMarker, AudioSegment, SplitSettings
├── utils/
│   ├── audioMath.ts      # Pure mathematical conversion utilities (zero side-effects)
│   ├── silenceDetector.ts# Dynamic Programming pathfinder for quiet frame splits
│   ├── wavExporter.ts    # 16-bit PCM WAV binary generator, TXT manifest & ZIP packer
│   └── demoAudio.ts      # Synthesized test AudioBuffer generator
└── components/
    ├── Header.tsx        # Application title & loaded audio metadata bar
    ├── AudioUploader.tsx # File dropzone & demo trigger button
    ├── WaveformViewer.tsx# HTML5 Canvas interactive waveform editor
    ├── ControlPanel.tsx  # Frame range sliders, auto-detection & export buttons
    └── SegmentList.tsx   # Table of segments with preview & download actions
```

---

## 🛠️ 4. Build & Verification Commands

Whenever modifying files in this codebase, run the following verification steps:

```bash
# 1. Type check & Vite build verification
npm run build

# 2. Run mathematical unit test verification (if test script exists)
node test_runner.js
```

---

## 🎨 5. UI/UX & Code Style Guidelines

1. **TypeScript Strictness**:
   - `noImplicitAny` is enabled. All component props, helper parameters, and event handlers must have explicit type definitions.
   - Use types from `src/types/audio.ts` rather than inline object shapes.

2. **Web Audio Context Management**:
   - Always check `audioCtx.state === 'suspended'` and call `resume()` inside user gesture callbacks.
   - Clean up `AudioBufferSourceNode` instances and `cancelAnimationFrame` handles when stopping audio playback or unmounting components.

3. **Styling & Theme**:
   - Maintain the dark glassmorphism design palette defined in `src/index.css`.
   - Use monospace font (`'JetBrains Mono'`) for frame numbers, sample indices, time values, and filenames.
