import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const playgroundRoot = __dirname

export default defineConfig({
  root: playgroundRoot,
  base: process.env.ONEDICE_PLAYGROUND_BASE ?? '/',
  resolve: {
    alias: {
      '@onedice/core': resolve(playgroundRoot, '../../src/index.ts'),
    },
  },
  build: {
    outDir: resolve(playgroundRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        playground: resolve(playgroundRoot, 'index.html'),
        docs: resolve(playgroundRoot, 'docs.html'),
      },
    },
  },
})
