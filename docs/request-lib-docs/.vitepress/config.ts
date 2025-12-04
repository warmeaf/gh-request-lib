import { defineConfig } from 'vitepress'

import themeConfig from './themeConfig'

const fileAndStyles: Record<string, string> = {}

export default defineConfig({
  title: '请求库文档',
  description: '分层架构的前端请求库',
  lang: 'zh-CN',
  base: '/gh-request-lib/',

  themeConfig,

  markdown: {
    lineNumbers: true,
  },

  vite: {
    ssr: {
      noExternal: [
        'naive-ui',
        'date-fns',
        'vueuc',
        'request-api',
        'request-imp-axios',
        'request-imp-fetch',
      ],
    },
  },
  postRender(context) {
    const styleRegex = /<css-render-style>((.|\s)+)<\/css-render-style>/
    const vitepressPathRegex = /<vitepress-path>(.+)<\/vitepress-path>/
    const style = styleRegex.exec(context.content)?.[1]
    const vitepressPath = vitepressPathRegex.exec(context.content)?.[1]
    if (vitepressPath && style) {
      fileAndStyles[vitepressPath] = style
    }
    context.content = context.content.replace(styleRegex, '')
    context.content = context.content.replace(vitepressPathRegex, '')
  },
  transformHtml(code, id) {
    const html = id.split('/').pop()
    if (!html) return
    const style = fileAndStyles[`/${html}`]
    if (style) {
      return code.replace(/<\/head>/, `${style}</head>`)
    }
  },
})
