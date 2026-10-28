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

Les fabriques importent leurs styles : `ol/ol.css` et
`geopf-extensions-openlayers/css/Classic.css` pour la 2D,
`geopf-extensions-itowns/css/Classic.css` pour la 3D.
Ne pas les importer globalement dans le point d'entree de l'application.
Avec Vite, conserver si necessaire `define: { global: 'globalThis' }`, comme dans
la configuration de cette application. Le navigateur doit prendre en charge
WebGL et ResizeObserver.

Les extensions OpenLayers et iTowns reutilisent des selecteurs CSS `GP*`.
La configuration PostCSS de Vite limite les regles CSS des extensions a
`.map2d` ou `.map3d`, sans augmenter leur specificite (`:where`).
Les variables declarees sur `:root` sont egalement limitees au conteneur.
Chaque controleur ajoute sa classe a sa cible. Un alias Vite redirige l'import
automatique `./packages/Styles` de l'index iTowns vers son bundle Classic,
pour ne pas charger les memes styles une seconde fois.
Conserver cette isolation et cet alias
dans la configuration du bundler d'un projet hote utilisant les deux moteurs.

Dans l'application, le composant 3D et iTowns sont charges par `import()`
uniquement a la premiere demande de bascule. Le globe est ensuite conserve
pour les bascules suivantes. La 2D reste visible pendant le chargement et en
cas d'erreur, avec possibilite de reessayer.

Le composable applicatif `src/composables/useMapMode.js` centralise le mode,
la disponibilite des deux vues, le chargement, les erreurs et la protection
contre les initialisations apres demontage. Il fournit aux composants les
options des moteurs avec un predicat `isActive` propre a chaque vue.

Pour conserver ce chargement differe dans un projet hote, importer la fabrique
2D depuis `./maps/createMap2D.js`, puis charger `./maps/createMap3D.js` par
`import()` a la demande. L'index commun ci-dessous exporte statiquement les
deux moteurs : ne pas l'utiliser comme point d'entree du chargement differe.

Exemple de composant sans Pinia :

```js
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
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
- `layers` : `layerDescriptors`, `descriptors2D`, `descriptors3D`,
  `addLayer(idOuDescripteur)`, `updateLayer(id, changements)`,
  `reorderLayers(idsOrdonnes)` et `removeLayer(id)`.
- `controls` : `controlIds`, `controls2D`, `controls3D` et `addControl(id)`.

Les options sont `coordinates`, `zoom`, `layerIds`, `layerDescriptors`, `controlIds` et
`elevationLayerId`. Le relief est ajoute uniquement en 3D ; utiliser
`elevationLayerId: null` pour le desactiver. Les listes d'entree sont copiees.

```js
state.view.setView({ longitude: 4.8357, latitude: 45.764 }, 12)
state.layers.addLayer('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2')
state.layers.removeLayer('ORTHOIMAGERY.ORTHOPHOTOS')
```

Chaque descripteur est independant des moteurs :

```js
{
  id: 'orthophotos',
  type: 'WMTS',
  visible: true,
  opacity: 0.75,
  order: 0,
  source: { layer: 'ORTHOIMAGERY.ORTHOPHOTOS' },
}
```

`source.layer` est l'identifiant du catalogue Geoplateforme, pas une instance
de source OpenLayers ou iTowns. Les sources hors catalogue et les autres types
de couches restent hors de ce contrat WMTS. Les descripteurs sont tries par
`order` croissant, du bas vers le haut. Visibilite et opacite sont conservees
meme pour une couche masquee ; l'opacite doit etre comprise entre 0 et 1.
Le relief reste reserve a la 3D et ne fait pas partie de l'ordre des images.

```js
state.layers.updateLayer('orthophotos', { visible: false, opacity: 0.4 })
state.layers.reorderLayers(['orthophotos', 'plan'])
```

`layerDescriptors` peut etre fourni a la creation a la place de `layerIds`.
Les descripteurs et leurs objets `source` sont copies. L'ajout d'une chaine
cree un descripteur WMTS visible, d'opacite 1, au-dessus des couches existantes.
Un ajout en double ne remplace pas les proprietes de la couche.
Les modifications invalides via les actions levent une erreur sans changer
l'etat. `reorderLayers` attend tous les identifiants partages, sans doublon.

`layerIds`, `layers2D` et `layers3D` restent des listes d'identifiants derivees
pour la compatibilite. Remplacer `layerIds` conserve les proprietes des couches
deja presentes et adopte le nouvel ordre. Utiliser les actions pour modifier
les couches, plutot que de muter ces listes derivees.
Les anciens objets ne fournissant que `layers2D` / `layers3D` restent acceptes
par les adaptateurs, avec les proprietes par defaut.

`createMap2D({ view, layers, controls, mapOptions, controlTypes, isActive })` et
`createMap3D({ view, layers, controls, globeOptions, controlTypes, attribution,
elevationLayerId, isActive })` renvoient un controleur avec :

- `load(element)` : initialise la carte et renvoie une promesse de l'instance
  du moteur. Un nouvel appel nettoie la session precedente du meme controleur.
- `dispose()` : arrete les observations et ecouteurs et libere les ressources
  de la session. Peut etre appele plusieurs fois. Une initialisation 3D annulee
  se termine sans instance.

`isActive()` autorise les remontees de navigation vers `view.setView`.
L'application ne les autorise que pour la vue visible et prete. La vue masquee
continue de recevoir le point de vue partage, les couches et les controles.
Sans ce predicat optionnel, les fabriques conservent leur comportement
bidirectionnel pour les integrations existantes.

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

La synchronisation bidirectionnelle couvre le centre, le zoom, les ajouts et
retraits des couches WMTS presentes dans le catalogue, leur visibilite, leur
opacite et leur ordre. Les gestionnaires natifs des deux moteurs mettent a jour
le meme store. La reconciliation ne recree pas les couches pour une simple
modification de propriete ; un changement de source recree la couche concernee.
Les ecouteurs de proprietes sont retires a la suppression et au nettoyage.
Les controles sont ajoutes sans doublon ; leur retrait dynamique n'est pas
encore synchronise.

Les anciens composables `useLoad2D` / `useDispose2D` et `useLoad3D` /
`useDispose3D` restent des adaptateurs de compatibilite, limites a une instance
par moteur. Utiliser les fabriques pour toute nouvelle integration multi-cartes.
