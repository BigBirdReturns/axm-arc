import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const external = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    target: "node22",
    outDir: "creator-kit/dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: "tools/creator-kit-cli.ts",
      formats: ["es"],
      fileName: () => "rodoh-cartridge.mjs",
    },
    rollupOptions: {
      external: (id) => external.has(id),
    },
  },
});
