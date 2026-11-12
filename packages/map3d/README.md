# Bibliotheque Vue 3 `@portail/map3d`

Cette bibliotheque fournit le composant Vue et le controleur de rendu 3D. Elle
ne cree pas l'etat cartographique et ne charge pas la configuration du catalogue :
ces responsabilites appartiennent a l'application hote. Elle ne depend pas de
Pinia. Le navigateur doit prendre en charge WebGL et `ResizeObserver`, et le
conteneur doit avoir des dimensions.

## Construire et distribuer

Depuis la racine du depot :

```sh
npm install
npm run build:map3d
npm pack --workspace @portail/map3d
```

L'archive est installable dans une application Vue 3 + Vite ou publiable sur
un registre prive. Le nom `@portail/map3d` est local au projet : verifier les
droits sur ce nom avant toute publication.

```sh
npm install ./portail-map3d-0.2.0.tgz vue@^3.5.0 itowns@2.38.2 three@0.137.5 proj4@2.15.0 geoportal-access-lib@3.4.6
```

L'extension `geopf-extensions-itowns` utilisee est incluse dans le build :
il n'est pas necessaire de l'installer separement dans l'application hote.
`geoportal-access-lib` reste une dependance partagee requise par l'extension,
meme si le catalogue est initialise par l'hote. Le paquet contient
`dist/THIRD-PARTY-LICENSES.md` et l'archive source exacte de l'extension.
Celle-ci est sous licence AGPL-3.0 ; verifier les obligations de licence et la
compatibilite du projet hote avant distribution ou deploiement.

Dans `vite.config.js` du projet hote :

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { Map3D } from '@portail/map3d/vite'

export default defineConfig({ plugins: [vue(), Map3D()] })
```

Le plugin configure `global`, resout `buffer` et `loglevel`, et evite les
doublons des dependances partagees. Les styles de l'extension sont deja limites
a `.map3d` ; importer `@portail/map3d/style.css` une fois. Si une carte
OpenLayers est egalement presente, isoler separement ses styles.

## Integration dans le projet experimental

Avant de charger le globe, l'application hote doit initialiser le catalogue
Geoplateforme si elle utilise les couches WMTS ou le relief. Le code ci-dessous
emploie les stores et le chargeur du projet experimental : adapter ces imports
si l'application hote utilise une autre organisation.

```vue
<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import '@portail/map3d/style.css'
import { useGetConfig } from '@/composables/getConfig'
import { ELEVATION_LAYER_ID, useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useMapStore } from '@/stores/map'

const Map3D = defineAsyncComponent(() =>
  import('@portail/map3d').then(({ Map3D }) => Map3D))
const options = {
  view: useMapStore(),
  layers: useLayersStore(),
  controls: useControlsStore(),
  elevationLayerId: ELEVATION_LAYER_ID,
}
const ready = ref(false)
const error = ref(null)
let unmounted = false

onBeforeUnmount(() => { unmounted = true })
onMounted(async () => {
  try {
    await useGetConfig()
    if (!unmounted) ready.value = true
  } catch (cause) {
    if (!unmounted) error.value = cause
  }
})
</script>

<template>
  <p v-if="error" role="alert">Impossible de charger la carte : {{ error.message }}</p>
  <Map3D
    v-if="ready"
    :options="options"
    class="globe"
    @error="error = $event"
  />
</template>

<style scoped>
.globe { width: 100%; height: 500px; }
</style>
```

L'exemple charge le JavaScript 3D a la demande ; les styles sont importes
separement. L'application experimentale charge aussi les styles a la demande
et gere leur nouvelle tentative en cas d'erreur reseau.

## Contrat de l'etat fourni par l'hote

La prop obligatoire `options` contient des objets reactifs appartenant a l'hote :

- `view` expose `coordinates: { longitude, latitude }` en WGS84, `zoom` et
  `setView(coordinates, zoom)`.
- `layers` expose `layers2D`, `layers3D`, `addLayer`, `removeLayer` et
  eventuellement `updateLayer`. `layers3D` indique les couches actives.
  `descriptors3D` peut fournir leurs descripteurs normalises
  `{ id, type, visible, opacity, order, source: { layer } }`, tries du bas vers
  le haut ; les descripteurs absents de `layers3D` ne sont pas affiches.
  Sans cette liste, les identifiants de `layers3D` sont interpretes comme des
  couches WMTS avec leurs proprietes par defaut.
- `controls` expose la liste reactive `controls3D`. Les controles connus sont
  `LayerSwitcher`, `Scale` et `MousePosition`.
- `elevationLayerId` identifie une couche de relief dans une liste d'identifiants.
  Dans les descripteurs, le type `elevation` identifie aussi le relief. Pour
  desactiver celui-ci, l'hote ne doit pas l'inclure dans les couches 3D.

La navigation et les changements de couches effectues depuis le globe sont
transmis aux actions fournies par l'hote. `options` peut aussi contenir
`globeOptions`, `controlTypes`, `attribution` et `isActive`. Les options sont
lues a la creation ; leurs objets d'etat restent reactifs.

`ready` transmet le globe initialise et `error` transmet l'erreur de chargement.
Les erreurs de synchronisation ulterieures sont journalisees dans la console.
Pour charger manuellement, passer `:auto-load="false"` et appeler `load()` sur
la reference du composant ; la promesse transmet l'erreur a l'appelant. Le globe
est libere au demontage et `ready` n'est pas emis si le chargement est annule.

La fabrique `createMap3D(options)` est egalement exportee depuis
`@portail/map3d/core`. Elle renvoie `load(element)` et `dispose()` ;
`useMap3D(options)` expose le meme controleur et le libere au demontage du
composant Vue appelant.

## Migration depuis 0.1

Les exports `@portail/map3d/state`, `@portail/map3d/config`, `createMapState`
et `loadMapConfig` ont ete retires du package : l'hote gere son propre etat et
son catalogue. Le composant ne fournit plus les props `view`, `layers`,
`controls` ni les `v-model` associes ; transmettre les objets reactifs via
`options`. Le contrat et l'exemple complets de l'application sont aussi
presentes dans `USAGE.md` a la racine du depot source.
