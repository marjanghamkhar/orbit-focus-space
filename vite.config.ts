import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from https://marjanghamkhar.github.io/orbit-focus-space/,
// so production builds (and `npm run preview`, which serves them) use that sub-path.
// Local `npm run dev` keeps using "/".
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/orbit-focus-space/' : '/',
  plugins: [react()],
}));
