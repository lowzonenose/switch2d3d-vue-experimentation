import './assets/main.css'

import "ol/ol.css";
import "geopf-extensions-openlayers/css/Classic.css";

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
