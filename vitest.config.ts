import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'], // 配置为扫描所有子包
  },
})
