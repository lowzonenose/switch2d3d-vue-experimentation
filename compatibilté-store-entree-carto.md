# sur switch2d3d, on a fait une implementation des couches avec state.js, mais ce choix est il compatible avec le projet cartes.gouv.fr-entree-carto si on decide d'intégrer la 3d dans ce projet ?

**Oui pour le principe, mais pas en remplacement direct du stockage actuel.**

`state.js` sépare l’état cartographique des objets natifs d’OpenLayers ou d’iTowns : les couches sont décrites par des données réactives, puis chaque moteur les traduit en couches affichables. C’est une bonne base pour partager un état entre 2D et 3D. Le projet cible utilise déjà Vue 3 et Pinia, et `la bibliothèque 3D` attend justement que l’application hôte fournisse cet état et charge son catalogue. Le modèle est visible dans `createLayersState`.

La différence importante est que l’application cartes.gouv.fr possède déjà son propre état de couches : `mapStore` conserve les couches dans un format lié au stockage local et aux permaliens, avec ses propres actions d’ajout, de retrait et de mise à jour (`addLayer`)). Et son périmètre est plus large : catalogue, services WMS/WMTS, imports, dessins, favoris et calculs (`Layer.vue`, `layer.js`)). Le contrat actuel de `state.js`, centré sur des descripteurs de couches de catalogue, ne couvre pas automatiquement tous ces cas.

**Recommandation :** garder un seul état faisant autorité. Pour une première intégration limitée aux couches du catalogue, créer un adaptateur entre `mapStore` et les descripteurs attendus par la 3D, et faire remonter les changements de la 3D vers les actions de `mapStore`. Cela préserverait stockage, permaliens et comportement 2D, sans créer deux listes de couches indépendantes. Il faudra aussi adapter le point de vue : OpenLayers met à jour notamment le centre en coordonnées EPSG:3857, tandis que le contrat de `state.js` utilise longitude/latitude (`Map.vue`)).

**Verdict :** le choix de `state.js` est compatible comme **contrat d’état partagé pour une intégration 3D ciblée** ; il ne l’est pas comme substitut immédiat à toute la gestion des couches de l’application.
