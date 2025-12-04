import { nextTick } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import { createMermaidRenderer } from 'vitepress-mermaid-renderer'
import 'vitepress-mermaid-renderer/dist/style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    const mermaidRenderer = createMermaidRenderer()
    mermaidRenderer.initialize()
    if (router) {
      router.onAfterRouteChange = () => {
        nextTick(() => mermaidRenderer.renderMermaidDiagrams())
      }
    }
  },
} satisfies Theme
