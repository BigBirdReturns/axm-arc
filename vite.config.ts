import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

let buildSha = 'dev';
try {
  buildSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* not a git checkout — leave as 'dev' */
}

// Reproducible-build boundary. The service-worker cache name used to contain
// Date.now(), which made two builds of the same source tree differ byte-for-byte.
// The exact Git identity is already the correct cache boundary. SOURCE_DATE_EPOCH
// remains available for packagers that intentionally need a second deterministic
// build coordinate, but no wall clock enters the output by default.
const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH?.trim() ?? '';
if (sourceDateEpoch && !/^\d+$/.test(sourceDateEpoch)) {
  throw new Error(`Invalid SOURCE_DATE_EPOCH="${sourceDateEpoch}". Expected whole Unix seconds.`);
}
const cacheVersion = sourceDateEpoch ? `${buildSha}-${sourceDateEpoch}` : buildSha;

// Build-time deploy variant. Flips positioning copy on the entry surfaces
// (title screen CTAs and kicker) without forking code — the engine and all
// gameplay remain identical. Set via `VITE_VARIANT=enterprise-first npm run
// build` (or VARIANT=...). Default is game-first.
const VALID_VARIANTS = ['game-first', 'enterprise-first', 'research-first'] as const;
const rawVariant = process.env.VITE_VARIANT ?? process.env.VARIANT ?? 'game-first';
if (!(VALID_VARIANTS as readonly string[]).includes(rawVariant)) {
  throw new Error(
    `Invalid VITE_VARIANT="${rawVariant}". Must be one of: ${VALID_VARIANTS.join(', ')}`,
  );
}
const variant = rawVariant;

// Service worker source. Emitted at the root of the build output (so its
// scope covers the whole app under `base`) with __PRECACHE__/__CACHE_VERSION__
// replaced at build time by the plugin below.
const SW_SOURCE = `const CACHE = 'axm-arc-__CACHE_VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first (an updated deploy wins when online), cache
  // fallback so an offline launch still boots the shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('./'))),
    );
    return;
  }

  // Everything else same-origin: cache-first (precached hashed assets are
  // immutable), falling back to network and caching successful responses.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    );
  });
});
`;

// Emits sw.js into the bundle with the precache manifest baked in: every
// hashed bundle asset plus the shell ("./") and everything in public/
// (manifest, icons, fonts). Runs at generateBundle so the hashed filenames
// are known.
function swPrecachePlugin(): Plugin {
  return {
    name: 'sw-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      const walkPublic = (dir: string, prefix: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory()
            ? walkPublic(`${dir}/${entry.name}`, `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`],
        );
      const precache = [
        './',
        ...Object.keys(bundle)
          .filter((f) => f !== 'index.html')
          .map((f) => `./${f}`),
        ...walkPublic('public', '').map((f) => `./${f}`),
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: SW_SOURCE.replace('__CACHE_VERSION__', cacheVersion).replace(
          '__PRECACHE__',
          JSON.stringify(precache),
        ),
      });
    },
  };
}

export default defineConfig({
  base: '/axm-arc/game/',
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
    __VARIANT__: JSON.stringify(variant),
  },
  build: {
    outDir: 'docs/game',
    emptyOutDir: true,
  },
  plugins: [react(), swPrecachePlugin()],
});
