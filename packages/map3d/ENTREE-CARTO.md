# Adaptateur cartes.gouv.fr-entree-carto

`@portail/map3d` fournit `createEntreeCartoAdapter` pour relier le composant
`Map3D` au store Pinia `useMapStore` de cartes.gouv.fr-entree-carto, sans faire
entrer Pinia ni les dependances de l'application dans la bibliotheque.
L'adaptateur est fourni a la prop `adapter` du composant :

```vue
<script setup>
import { defineAsyncComponent } from 'vue'
import '@portail/map3d/style.css'
import { createEntreeCartoAdapter } from '@portail/map3d'
import { useMapStore } from '@/stores/mapStore'

const Map3D = defineAsyncComponent(() =>
  import('@portail/map3d').then(({ Map3D }) => Map3D))

const options = {
  mapStore: useMapStore(),
  elevationLayerId: 'ELEVATION.ELEVATIONGRIDCOVERAGE',
}
</script>

<template>
  <Map3D :options="options" :adapter="createEntreeCartoAdapter" />
</template>
```

Le catalogue Geoplateforme doit etre initialise par l'application hote avant le
chargement du composant. Le chargeur et le moment de ce chargement restent sous
le controle de l'application.

## Synchronisation prise en charge

- Le centre et le zoom sont lus depuis `mapStore.lon`, `mapStore.lat` et
  `mapStore.zoom`. La navigation dans le globe met ces valeurs a jour, ainsi que
  `x` et `y` en EPSG:3857 ; si `mapStore.getMap()` fournit une carte OpenLayers,
  son centre et son zoom existants sont egalement synchronises.
- Les couches selectionnees proviennent de `getLayers()` et de
  `getLayerProperty(id)`. Seules les couches catalogue WMTS sont affichees en
  3D. L'adaptateur conserve `name` comme identifiant du controleur 3D et
  resout `name$GEOPORTAIL:OGC:WMTS` pour lire ou modifier le store. Les couches
  WMS, TMS, les dessins, les imports et les favoris restent hors de
  l'adaptateur.
- Les ajouts, retraits, l'ordre, la visibilite et l'opacite du globe sont
  retransmis par `addLayer`, `removeLayer` et `updateLayerProperty` du store.
  Les couches ajoutees depuis le globe sont enregistrees sous la forme
  `name$GEOPORTAIL:OGC:WMTS`. Le rendu 3D ne synchronise pas le niveau de gris.
- Le relief est active par defaut avec l'identifiant
  `ELEVATION.ELEVATIONGRIDCOVERAGE` ; fournir `elevationLayerId: null` pour le
  desactiver ou un autre identifiant pour le remplacer.
- `LayerSwitcher`, `MousePosition` et `ScaleLine` sont convertis en controles
  3D (`LayerSwitcher`, `MousePosition` et `Scale`). Les autres controles de
  l'application ne sont pas ajoutes au globe. `controlMappings` permet de
  declarer explicitement des correspondances supplementaires ; fournir le
  constructeur correspondant dans `controlTypes`.

La fabrique accepte aussi les options habituelles du globe (`globeOptions`,
`controlTypes`, `attribution` et `isActive`) dans le meme objet que `mapStore`.
La prop `adapter` accepte une fonction `(options) => Map3DOptions` ; elle peut
donc aussi servir a connecter un autre store sans modifier l'API du controleur.

Le composant n'importe pas le store de l'application et ne l'instancie pas :
l'hote passe l'instance Pinia deja active dans `options.mapStore`. Il faut donc
obtenir le store depuis le contexte Pinia actif de l'application. Les couches qui
ne sont pas des WMTS catalogue necessitent une integration specifique et ne
sont pas converties silencieusement en couches 3D.
