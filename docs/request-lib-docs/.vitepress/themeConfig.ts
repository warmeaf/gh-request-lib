import type { DefaultTheme } from 'vitepress'

const themeConfig: DefaultTheme.Config = {
  nav: [
    { text: '指南', link: '/guide/getting-started' },
    { text: '示例', link: '/examples/basic-requests' },
    { text: 'API', link: '/api/basic-requests' },
    { text: '概念', link: '/concepts/architecture' },
  ],

  sidebar: {
    '/guide/': [
      {
        text: '使用指南',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '安装指南', link: '/guide/installation' },
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
        ],
      },
    ],

    '/examples/': [
      {
        text: '使用示例',
        items: [
          { text: '基础请求', link: '/examples/basic-requests' },
          { text: '缓存请求', link: '/examples/caching' },
          { text: '重试请求', link: '/examples/retry-logic' },
          { text: '并发请求', link: '/examples/concurrent-requests' },
          { text: '幂等请求', link: '/examples/idempotent-requests' },
          { text: '串行请求', link: '/examples/serial-requests' },
        ],
      },
    ],

    '/api/': [
      {
        text: 'API',
        items: [
          { text: '基础请求', link: '/api/basic-requests' },
          { text: '缓存请求', link: '/api/caching' },
          { text: '重试请求', link: '/api/retry-logic' },
          { text: '并发请求', link: '/api/concurrent-requests' },
          { text: '幂等请求', link: '/api/idempotent-requests' },
          { text: '串行请求', link: '/api/serial-requests' },
        ],
      },
    ],
  },

  socialLinks: [
    { icon: 'github', link: 'https://github.com/warmeaf/gh-request-lib' },
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
