import type { DefaultTheme } from 'vitepress'

const themeConfig: DefaultTheme.Config = {
  nav: [
    { text: '指南', link: '/guide/getting-started' },
    { text: '概念', link: '/concepts/architecture' },
    { text: 'API', link: '/api/request-core' },
    { text: '示例', link: '/examples/basic-requests' },
  ],

  sidebar: {
    '/guide/': [
      {
        text: '使用指南',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '安装配置', link: '/guide/installation' },
          { text: '基础用法', link: '/guide/basic-usage' },
          { text: '进阶功能', link: '/guide/advanced-features' },
          { text: '故障排除', link: '/guide/troubleshooting' },
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

    '/api/': [
      {
        text: 'API参考',
        items: [
          { text: '核心层API', link: '/api/request-core' },
          { text: 'API层', link: '/api/request-api' },
          { text: '实现层API', link: '/api/implementations' },
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
          { text: '自定义API示例', link: '/examples/custom-apis' },
          { text: '框架集成示例', link: '/examples/integration' },
        ],
      },
    ],

    '/migration/': [
      {
        text: '迁移指南',
        items: [
          { text: '从Axios迁移', link: '/migration/from-axios' },
          { text: '从Fetch迁移', link: '/migration/from-fetch' },
          { text: '版本升级', link: '/migration/version-upgrade' },
        ],
      },
    ],

    '/development/': [
      {
        text: '开发指南',
        items: [
          { text: '贡献指南', link: '/development/contributing' },
          { text: '自定义实现', link: '/development/custom-implementation' },
          { text: '扩展功能', link: '/development/extending-features' },
          { text: '测试指南', link: '/development/testing' },
        ],
      },
    ],

    '/cookbook/': [
      {
        text: '实用技巧',
        items: [
          { text: '常用模式', link: '/cookbook/common-patterns' },
          { text: '性能优化', link: '/cookbook/performance-tips' },
          { text: '安全最佳实践', link: '/cookbook/security-best-practices' },
          { text: '调试技巧', link: '/cookbook/debugging' },
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
