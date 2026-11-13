import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { PluginMap3D } from '@portail/map3d/vite'

export default defineConfig({
  plugins: [vue(), PluginMap3D()],
})
