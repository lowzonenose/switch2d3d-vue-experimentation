import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { PluginMap3D } from '@portail/map3d/vite'

// https://vite.dev/config/
export default defineConfig({
  css: {
    postcss: {
      plugins: [{
        postcssPlugin: 'scope-map-styles',
        Once(root) {
          root.walkRules((rule) => {
            const file = rule.source?.input.file?.replaceAll('\\', '/')
            const scope = file?.includes('/geopf-extensions-openlayers/') ? '.map2d' : null
            if (!scope) return
            if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
            rule.selectors = rule.selectors.map((selector) => selector.includes(':root')
              ? selector.replaceAll(':root', `:where(${scope})`)
              : `:where(${scope}) ${selector}`)
          })
        },
      }],
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
    PluginMap3D(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  base: '/switch2d3d-vue-experimentation/'
})
