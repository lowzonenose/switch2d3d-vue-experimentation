# Demo `@portail/map3d`

Mini projet Vue 3 + Vite montrant l'integration du globe 3D dans une
application hote, sans Pinia. La demo possede son etat cartographique
(`src/mapState.js`) et initialise le catalogue Geoplateforme
(`src/catalog.js`) avant d'afficher le composant `Map3D`, comme l'exige le
contrat de la bibliotheque. Aucun plugin Vite n'est necessaire.

## Lancer la demo

La demo installe la bibliotheque depuis l'archive `npm pack` produite dans ce
dossier. Depuis `packages/map3d` (apres `npm install` dans `packages/map3d`) :

```sh
npm run demo
```

Ce script construit la bibliotheque, produit l'archive dans `demo/`, installe
les dependances de la demo puis lance le serveur de developpement.

La barre d'outils illustre la synchronisation bidirectionnelle : le point de
vue affiche suit la navigation dans le globe, et l'ajout ou le retrait d'une
couche dans l'etat hote est applique au globe. Le LayerSwitcher du globe met
aussi a jour la liste `layers3D` de l'hote.

Deux details d'integration a reprendre dans un projet hote :

- le predicat `isActive` n'autorise les remontees de navigation qu'une fois le
  globe pret (evenement `ready`), sinon les evenements emis pendant
  l'initialisation entrent en boucle avec la synchronisation de la vue ;
- le canvas du globe est mis en `display: block` et son conteneur en
  `overflow: hidden`, sinon l'espace de ligne du canvas fait osciller les
  scrollbars et le redimensionnement du globe.
