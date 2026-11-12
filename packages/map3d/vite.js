import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function geopfMap3D() {
  return {
    name: 'geopf-map3d',
    config() {
      return {
        define: { global: 'globalThis' },
        resolve: {
          dedupe: ['vue', 'itowns', 'three', 'proj4', 'geoportal-access-lib'],
          alias: [
            { find: /^buffer$/, replacement: require.resolve('buffer/') },
            { find: /^loglevel$/, replacement: require.resolve('loglevel') },
          ],
        },
      }
    },
  }
}
