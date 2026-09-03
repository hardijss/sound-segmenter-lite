import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Tauri loads the dev server in its own window; only auto-open a browser
    // tab for plain `npm run dev` sessions.
    open: !process.env.TAURI_ENV_PLATFORM,
  },
});
