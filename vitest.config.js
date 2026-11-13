import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      // Les sources aliasées de la lib doivent résoudre les dépendances (et leurs mocks) depuis la racine.
      dedupe: ['vue', 'itowns', 'three', 'proj4', 'geoportal-access-lib', 'geopf-extensions-itowns'],
      alias: [
        { find: /^@portail\/map3d$/, replacement: fileURLToPath(new URL('./packages/map3d/index.js', import.meta.url)) },
        { find: /^\.\/packages\/Styles$/, replacement: fileURLToPath(new URL('./node_modules/geopf-extensions-itowns/css/Classic.css', import.meta.url)) },
      ],
    },
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**', 'packages/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
