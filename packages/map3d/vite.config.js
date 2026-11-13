import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const require = createRequire(import.meta.url)

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'include-extension-source',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'geopf-extensions-itowns-1.0.0-beta.1.tgz',
          source: readFileSync(new URL('./modules/geopf-extensions-itowns-1.0.0-beta.1.tgz', import.meta.url)),
        })
      },
    },
  ],
  define: { global: 'globalThis' },
  resolve: {
    alias: [
      { find: /^\.\/packages\/Styles$/, replacement: require.resolve('geopf-extensions-itowns/css/Classic.css') },
      { find: /^buffer$/, replacement: require.resolve('buffer/') },
      { find: /^loglevel$/, replacement: require.resolve('loglevel') },
    ],
  },
  css: {
    postcss: {
      plugins: [{
        postcssPlugin: 'scope-map3d-styles',
        Once(root) {
          root.walkRules((rule) => {
            const file = rule.source?.input.file?.replaceAll('\\', '/')
            if (!file?.includes('/geopf-extensions-itowns/')) return
            if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
            rule.selectors = rule.selectors.map((selector) => selector.includes(':root')
              ? selector.replaceAll(':root', ':where(.map3d)')
              : `:where(.map3d) ${selector}`)
          })
        },
      }],
    },
  },
  build: {
    license: { fileName: 'THIRD-PARTY-LICENSES.md' },
    lib: {
      entry: {
        index: fileURLToPath(new URL('./index.js', import.meta.url)),
      },
      formats: ['es'],
      cssFileName: 'style',
    },
    rollupOptions: {
      external: (id) => ['vue', 'itowns', 'three', 'proj4', 'geoportal-access-lib'].some(
        (name) => id === name || id.startsWith(`${name}/`),
      ),
      // Chunk séparé pour que `global` soit défini avant l'évaluation des imports externes (itowns).
      output: {
        manualChunks: (id) => (id.endsWith('/src/global.js') ? 'global' : undefined),
      },
    },
  },
})
