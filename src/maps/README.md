# Module cartographique reutilisable

Ce dossier contient l'API ESM des cartes OpenLayers et iTowns. Il ne depend ni
de Pinia, ni du routeur, ni de l'alias `@` de l'application. Vue 3 reste une
dependance pour la reactivite. Chaque controleur possede ses propres ressources.

## Integration dans un autre projet

Integrer ce dossier dans un projet Vue 3 utilisant un bundler, avec les memes
dependances cartographiques que cette application : `ol`, `itowns`, `three`,
`geopf-extensions-openlayers`, `geopf-extensions-itowns`, `geoportal-access-lib`,
`proj4` et `buffer`. Les versions des extensions utilisees ici sont fournies sous
forme d'archives dans le dossier `modules` a la racine du projet.

Importer les styles `ol/ol.css` et `geopf-extensions-openlayers/css/Classic.css`.
Avec Vite, conserver si necessaire `define: { global: 'globalThis' }`, comme dans
la configuration de cette application. Le navigateur doit prendre en charge
WebGL et ResizeObserver.

Exemple de composant sans Pinia :

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import 'ol/ol.css'
import 'geopf-extensions-openlayers/css/Classic.css'
import { createMapState, createMap2D, createMap3D, loadMapConfig } from './maps/index.js'

const target2D = ref(null)
const target3D = ref(null)
const state = createMapState({
  coordinates: { longitude: 2.35, latitude: 48.86 },
  zoom: 12,
  layerIds: ['ORTHOIMAGERY.ORTHOPHOTOS'],
  controlIds: ['LayerSwitcher', 'Scale'],
})
const map2D = createMap2D(state)
const map3D = createMap3D(state)
let disposed = false

onMounted(async () => {
  try {
    await loadMapConfig()
    if (disposed) return
    await Promise.all([map2D.load(target2D.value), map3D.load(target3D.value)])
  } catch (cause) {
    map2D.dispose()
    map3D.dispose()
    console.error('Chargement des cartes impossible', cause)
  }
})

onBeforeUnmount(() => {
  disposed = true
  map2D.dispose()
  map3D.dispose()
})
</script>

<template>
  <div ref="target2D" class="map"></div>
  <div ref="target3D" class="map"></div>
</template>

<style scoped>
.map { width: 100%; height: 500px; }
</style>
```

Les deux cartes partagent le meme etat. Pour deux paires independantes, appeler
`createMapState()` une fois par paire. La superposition, le bouton et le fondu
restent dans l'interface du projet hote. Ne pas masquer un conteneur avec
`display: none` : conserver ses dimensions pour le rendu du moteur.

## API

`createMapState(options)` cree trois objets reactifs independants :

- `view` : `coordinates` en longitude/latitude WGS84, `zoom` et
  `setView({ longitude, latitude }, zoom)`.
- `layers` : `layerIds`, `layers2D`, `layers3D`, `addLayer(id)` et `removeLayer(id)`.
- `controls` : `controlIds`, `controls2D`, `controls3D` et `addControl(id)`.

Les options sont `coordinates`, `zoom`, `layerIds`, `controlIds` et
`elevationLayerId`. Le relief est ajoute uniquement en 3D ; utiliser
`elevationLayerId: null` pour le desactiver. Les listes d'entree sont copiees.

```js
state.view.setView({ longitude: 4.8357, latitude: 45.764 }, 12)
state.layers.addLayer('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2')
state.layers.removeLayer('ORTHOIMAGERY.ORTHOPHOTOS')
```

`createMap2D({ view, layers, controls, mapOptions, controlTypes })` et
`createMap3D({ view, layers, controls, globeOptions, controlTypes, attribution,
elevationLayerId })` renvoient un controleur avec :

- `load(element)` : initialise la carte et renvoie une promesse de l'instance
  du moteur. Un nouvel appel nettoie la session precedente du meme controleur.
- `dispose()` : arrete les observations et ecouteurs et libere les ressources
  de la session. Peut etre appele plusieurs fois. Une initialisation 3D annulee
  se termine sans instance.

`mapOptions` et `globeOptions` sont transmis aux constructeurs des moteurs.
La cible, les couches partagees, le centre et le zoom restent pilotes par le
controleur. `globeOptions` permet notamment de choisir `tilt` et `heading`.
`controlTypes` complete ou remplace les constructeurs connus par identifiant :

```js
const map3D = createMap3D({
  ...state,
  globeOptions: { tilt: 30, heading: 90 },
  attribution: [{ name: 'IGN', url: 'https://www.ign.fr/' }],
})
```

`loadMapConfig({ url, timeout })` charge le catalogue Geoplateforme avant les
cartes. Sans options, il conserve le catalogue public et le delai de 20 secondes
de cette application. Ses erreurs rejettent la promesse. Le catalogue est gere
par la bibliotheque Geoplateforme et reste partage dans la page.

## Contrat et limites

Les controleurs acceptent aussi des stores Pinia respectant les interfaces
`view`, `layers` et `controls` ci-dessus. Les fabriques `createViewState`,
`createLayersState` et `createControlsState` exportent les refs et actions
utilisables dans un store Pinia de type setup. Les stores de l'application
utilisent ces memes fabriques, sans dupliquer les valeurs par defaut.

La synchronisation bidirectionnelle couvre le centre, le zoom et les ajouts et
retraits des couches WMTS presentes dans le catalogue. La visibilite, l'opacite
et l'ordre des couches ne sont pas synchronises. Les controles sont ajoutes sans
doublon ; leur retrait dynamique n'est pas encore synchronise.

Les anciens composables `useLoad2D` / `useDispose2D` et `useLoad3D` /
`useDispose3D` restent des adaptateurs de compatibilite, limites a une instance
par moteur. Utiliser les fabriques pour toute nouvelle integration multi-cartes.
