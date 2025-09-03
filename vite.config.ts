import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: './packages/request-bus/src/index.ts',
      name: 'GhRequestLib',
      fileName: 'gh-request-lib',
    },
  },
})
