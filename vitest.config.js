import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: [
        { find: '@portail/map3d/core', replacement: fileURLToPath(new URL('./packages/map3d/src/createMap3D.js', import.meta.url)) },
        { find: /^@portail\/map3d$/, replacement: fileURLToPath(new URL('./packages/map3d/src/index.js', import.meta.url)) },
        { find: /^\.\/packages\/Styles$/, replacement: fileURLToPath(new URL('./node_modules/geopf-extensions-itowns/css/Classic.css', import.meta.url)) },
      ],
    },
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
