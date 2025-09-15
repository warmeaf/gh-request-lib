import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve('packages/request-api/src/index.ts'),
      name: 'RequestLib',
      fileName: (format) => `request-lib.${format}.js`,
      formats: ['es', 'umd', 'iife']
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: [],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {}
      }
    },
    sourcemap: true,
    minify: 'terser',
    target: 'es2020'
  },
  resolve: {
    alias: {
      'request-core': path.resolve('./packages/request-core/src'),
      'request-imp-axios': path.resolve('./packages/request-imp-axios/src'), 
      'request-imp-fetch': path.resolve('./packages/request-imp-fetch/src'),
      'request-api': path.resolve('./packages/request-api/src')
    }
  },
  define: {
    // 替换环境变量，确保浏览器兼容性
    'process.env.NODE_ENV': JSON.stringify('production')
  }
})
