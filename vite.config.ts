import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/axm-arc/game/',
  build: {
    outDir: 'docs/game',
    emptyOutDir: true,
  },
  plugins: [react()],
});
