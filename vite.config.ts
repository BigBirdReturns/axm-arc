import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

let buildSha = 'dev';
try {
  buildSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* not a git checkout — leave as 'dev' */
}

export default defineConfig({
  base: '/axm-arc/game/',
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
  },
  build: {
    outDir: 'docs/game',
    emptyOutDir: true,
  },
  plugins: [react()],
});
