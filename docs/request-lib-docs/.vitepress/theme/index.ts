import { nextTick } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import { NaiveUIContainer } from '@vitepress-demo-preview/component'
import '@vitepress-demo-preview/component/dist/style.css'

import { createMermaidRenderer } from 'vitepress-mermaid-renderer'
import 'vitepress-mermaid-renderer/dist/style.css'

export default {
  ...DefaultTheme,
  enhanceApp({ app, router }) {
    app.component('demo-preview', NaiveUIContainer)

    const mermaidRenderer = createMermaidRenderer()
    mermaidRenderer.initialize()
    if (router) {
      router.onAfterRouteChange = () => {
        nextTick(() => mermaidRenderer.renderMermaidDiagrams())
      }
    }
  },
} satisfies Theme
