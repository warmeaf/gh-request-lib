import { defineConfig } from 'vitepress'
import {
  containerPreview,
  componentPreview,
} from '@vitepress-demo-preview/plugin'

export default defineConfig({
  title: '请求库文档',
  description: '分层架构的前端请求库',
  lang: 'zh-CN',

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '概念', link: '/concepts/architecture' },
      { text: 'API', link: '/api/request-core' },
      { text: '示例', link: '/examples/basic-requests' },
      { text: '包文档', link: '/packages/request-core/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '使用指南',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '安装配置', link: '/guide/installation' },
            { text: '基础用法', link: '/guide/basic-usage' },
            { text: '高级功能', link: '/guide/advanced-features' },
            { text: '最佳实践', link: '/guide/best-practices' },
            { text: '故障排除', link: '/guide/troubleshooting' },
          ],
        },
      ],

      '/concepts/': [
        {
          text: '核心概念',
          items: [
            { text: '架构设计', link: '/concepts/architecture' },
            { text: '依赖注入', link: '/concepts/dependency-injection' },
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
            { text: '自定义API示例', link: '/examples/custom-apis' },
            { text: '框架集成示例', link: '/examples/integration' },
          ],
        },
      ],

      '/packages/': [
        {
          text: 'request-core',
          collapsed: false,
          items: [
            { text: '包概述', link: '/packages/request-core/' },
            {
              text: '功能模块',
              collapsed: true,
              items: [
                {
                  text: '缓存功能',
                  link: '/packages/request-core/features/cache',
                },
                {
                  text: '重试功能',
                  link: '/packages/request-core/features/retry',
                },
                {
                  text: '并发控制',
                  link: '/packages/request-core/features/concurrent',
                },
                {
                  text: '拦截器',
                  link: '/packages/request-core/features/interceptors',
                },
              ],
            },
            { text: 'API参考', link: '/packages/request-core/api-reference' },
          ],
        },
        {
          text: 'request-api',
          collapsed: false,
          items: [
            { text: '包概述', link: '/packages/request-api/' },
            { text: '工厂方法', link: '/packages/request-api/factory-methods' },
            { text: 'API参考', link: '/packages/request-api/api-reference' },
          ],
        },
        {
          text: '实现层',
          collapsed: true,
          items: [
            { text: 'Axios实现', link: '/packages/request-imp-axios/' },
            { text: 'Fetch实现', link: '/packages/request-imp-fetch/' },
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
  },

  markdown: {
    lineNumbers: true,
    config(md) {
      md.use(containerPreview)
      md.use(componentPreview)
    },
  },
})
