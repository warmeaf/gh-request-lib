import type { DefaultTheme } from 'vitepress'

const themeConfig: DefaultTheme.Config = {
  nav: [
    { text: '指南', link: '/guide/getting-started' },
    { text: '示例', link: '/examples/basic-requests' },
    { text: '概念', link: '/concepts/architecture' },
  ],

  sidebar: {
    '/guide/': [
      {
        text: '使用指南',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '安装配置', link: '/guide/installation' },
        ],
      },
    ],

    '/concepts/': [
      {
        text: '核心概念',
        items: [
          { text: '架构设计', link: '/concepts/architecture' },
          { text: '依赖倒置', link: '/concepts/dip' },
          { text: '请求生命周期', link: '/concepts/request-lifecycle' },
          { text: '错误处理', link: '/concepts/error-handling' },
        ],
      },
    ],

    '/examples/': [
      {
        text: '使用示例',
        items: [
          { text: '基础请求示例', link: '/examples/basic-requests' },
          { text: '缓存使用示例', link: '/examples/caching' },
          { text: '重试机制示例', link: '/examples/retry-logic' },
          { text: '并发请求示例', link: '/examples/concurrent-requests' },
          { text: '幂等请求示例', link: '/examples/idempotent-requests' },
          { text: '串行请求示例', link: '/examples/serial-requests' },
          { text: '自定义API示例', link: '/examples/custom-apis' },
          { text: '框架集成示例', link: '/examples/integration' },
        ],
      },
    ],
  },

  socialLinks: [
    { icon: 'github', link: 'https://github.com/your-org/request-lib' },
  ],

  footer: {
    message: '基于 ISC 许可发布',
    copyright: 'Copyright © 2025-present Request Lib',
  },

  search: {
    provider: 'local',
  },
}

export default themeConfig
