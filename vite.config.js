import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  css: {
    postcss: {
      plugins: [{
        postcssPlugin: 'scope-map-styles',
        Once(root) {
          root.walkRules((rule) => {
            const file = rule.source?.input.file?.replaceAll('\\', '/')
            const scope = file?.includes('/geopf-extensions-openlayers/') ? '.map2d'
              : file?.includes('/geopf-extensions-itowns/') ? '.map3d' : null
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
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Reuse the explicit Classic bundle instead of iTowns' automatic source CSS imports.
      {
        find: /^\.\/packages\/Styles$/,
        replacement: fileURLToPath(new URL('./node_modules/geopf-extensions-itowns/css/Classic.css', import.meta.url)),
      },
    ],
  },
  base: '/switch2d3d-vue-experimentation/'
})
