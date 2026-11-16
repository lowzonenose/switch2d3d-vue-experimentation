# Compatibilité avec le store de cartes.gouv.fr

Sur **switch2d3d**, on a fait une implementation des couches avec state.js, mais ce choix est il compatible avec le projet cartes.gouv.fr-entree-carto si on decide d'intégrer la 3d dans ce projet ?

**Oui pour le principe, mais pas en remplacement direct du stockage actuel.**

`state.js` sépare l’état cartographique des objets natifs d’OpenLayers ou d’iTowns : les couches sont décrites par des données réactives, puis chaque moteur les traduit en couches affichables. C’est une bonne base pour partager un état entre 2D et 3D. Le projet cible utilise déjà Vue 3 et Pinia, et `la bibliothèque 3D` attend justement que l’application hôte fournisse cet état et charge son catalogue. Le modèle est visible dans `createLayersState`.

La différence importante est que l’application cartes.gouv.fr possède déjà son propre état de couches : `mapStore` conserve les couches dans un format lié au stockage local et aux permaliens, avec ses propres actions d’ajout, de retrait et de mise à jour. Son périmètre est plus large : catalogue, services WMS/WMTS, imports, dessins, favoris et calculs.

**Le contrat actuel de `state.js`, centré sur des descripteurs de couches de catalogue, ne couvre pas automatiquement tous ces cas.**

## Adaptateur disponible

La bibliothèque `@portail/map3d` fournit désormais `createEntreeCartoAdapter`. Passé à la prop `adapter` du composant `Map3D`, il adapte l’instance `mapStore` fournie dans `options.mapStore` au contrat attendu par la 3D. Le store de l’entrée carto reste l’état faisant autorité : il n’est pas remplacé par `state.js` et aucune liste de couches indépendante n’est créée.

L’adaptateur :

- lit les couches WMTS du catalogue depuis le store et convertit leurs identifiants `nom$GEOPORTAIL:OGC:WMTS` pour le globe ;
- transmet les ajouts, retraits, changements de visibilité, d’opacité et de position aux actions du store ;
- lit le centre en longitude/latitude et le zoom du store ; lors de la navigation 3D, il met également à jour `x` et `y` en EPSG:3857 et, si elle est disponible, la vue OpenLayers ;
- adapte les contrôles compatibles et ajoute un relief configurable.

La synchronisation reste **limitée aux couches WMTS du catalogue** : les couches WMS et TMS, les imports, dessins, favoris et calculs nécessitent une prise en charge spécifique. Le niveau de gris n’est pas synchronisé en 3D. L’application hôte reste responsable de l’initialisation du catalogue avant le chargement du globe.

Un exemple d’intégration et le détail des options sont disponibles dans [ENTREE-CARTO.md](./packages/map3d/ENTREE-CARTO.md). L’adaptateur est testé dans le paquet, mais son intégration complète dans l’application entrée carto reste à valider.

**Verdict :** l’adaptateur permet de relier le store existant à la bibliothèque 3D pour une **intégration ciblée**, sans substituer `state.js` à toute la gestion des couches de l’application.
