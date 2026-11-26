import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths + HashRouter: the same build runs on GitHub Pages (/akord-music-academy/) and locally.
export default defineConfig({
  plugins: [react()],
  base: './',
});
