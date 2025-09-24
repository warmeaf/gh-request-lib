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
      // 外部化处理不想打包进库的依赖
      external: ['axios'],
      output: {
        // 为外部化的依赖提供全局变量
        globals: {
          'axios': 'axios'
        },
        // 优化分包策略
        manualChunks: undefined
      }
    },
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
    // 构建优化
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false, // 提升构建速度
    emptyOutDir: true
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
