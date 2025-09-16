import { defineConfig } from 'vitepress'
import {
  containerPreview,
  componentPreview,
} from '@vitepress-demo-preview/plugin'

import themeConfig from './themeConfig'

export default defineConfig({
  title: '请求库文档',
  description: '分层架构的前端请求库',
  lang: 'zh-CN',

  themeConfig,

  markdown: {
    lineNumbers: true,
    config(md) {
      md.use(containerPreview)
      md.use(componentPreview)
    },
  },
})
