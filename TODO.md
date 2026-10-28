# Comparer l’implémentation à la spécification du dépôt

puis lister les écarts avec les modifications nécessaires.

**Non, pas entièrement.** L’implémentation constitue un prototype fonctionnel, mais ne couvre pas encore la v1 décrite dans la spécification.

Les premiers écarts sont nets :

- le chargement 3D est désormais différé au premier passage en 3D ; le store conserve des descripteurs de couches avec visibilité, opacité et ordre.

- Le bouton et la synchronisation de base sont présents, mais plusieurs exigences « Must » restent absentes.

## **Écarts Prioritaires**

- [x] 1. **Synchronisation des couches par descripteurs — FR-003, FR-005, FR-014.**
   Le store conserve des descripteurs `{ id, type, visible, opacity, order, source }`. Les adaptateurs réconcilient ajouts, suppressions, visibilité, opacité et ordre, y compris au premier chargement 3D. Les modifications des gestionnaires de couches natifs remontent dans le même store. Le relief reste propre à la 3D et les listes d'identifiants sont conservées comme API de compatibilité. Le contrat de source reste limité aux couches WMTS du catalogue (autres types : point 4).

- [x] 2. **Chargement 3D différé — NFR-001, ADR-003.**
   Le composant 3D et ses dépendances iTowns sont importés dynamiquement à la première demande de bascule. Le globe n'est créé qu'à ce moment, puis conservé pour les bascules suivantes. La vue 2D importe directement sa fabrique, sans passer par l'index commun aux deux moteurs.

- [x] 3. **Bascule après disponibilité, avec repli utilisateur — FR-007, FR-008.**
   `useMapMode` attend la fin du chargement 3D avant de modifier `is3D`. Pendant ce chargement, un indicateur est affiché, le bouton de bascule est désactivé et la 2D reste visible et interactive. En cas d'erreur, l'application reste en 2D, affiche une alerte et permet une nouvelle tentative via le bouton de bascule. Ces comportements sont couverts par les tests de `TheExperimentation`.

- [ ] 4. **Types de couches insuffisamment couverts — FR-004, FR-009.**  
   Les adaptateurs créent uniquement des couches WMTS et le relief. Le WMS, notamment, manque ; les couches incompatibles ne sont pas signalées. Ajouter des convertisseurs par type, `supports()` et un rapport des couches non prises en charge. Voir `createMap3D.js:160`.

- [ ] 5. **Couches protégées non couvertes explicitement — FR-011, NFR-005.**  
   Aucun mécanisme applicatif d’injection de jeton Bearer n’est prévu dans la construction des sources. Ajouter une configuration d’authentification commune aux requêtes des deux moteurs, puis des tests vérifiant les en-têtes et l’absence de jeton dans les URL. Voir `createMap3D.js:161`. Ce constat ne démontre pas une fuite actuelle.

- [x] 6. **Orchestration centralisée — ADR-001, ADR-002.**
   `useMapMode` centralise mode, disponibilité des vues, chargement différé et erreurs. `TheExperimentation.vue` se limite au branchement de l'interface. Les fabriques reçoivent un prédicat `isActive` : seule la vue active remonte sa navigation au store ; la vue masquée continue de recevoir les mises à jour partagées.

- [ ] 7. **Widgets et DSFR incomplets — FR-013 à FR-016, NFR-006, NFR-010.**  
   Le bouton est personnalisé, les styles OpenLayers sont `Classic`, et seuls trois contrôles sont configurés. Prévoir une interface DSFR commune, le zoom dans les deux vues, le plein écran et la minimap ; vérifier également l’équivalence des coordonnées affichées. Voir `main.js:4` et `state.js:39`.

- [ ] 8. **Validation insuffisante pour déclarer la conformité — FR-006, NFR-003, NFR-008, NFR-009.**  
   Les tests unitaires utilisent un moteur 3D simulé ; ils ne prouvent pas l’équivalence d’échelle réelle, la compatibilité Safari ou l’absence de fuite GPU. Le seul test E2E couvre la page d’accueil. Ajouter les scénarios de bascule, erreurs, couches et navigation sous Chromium/WebKit, ainsi que des mesures après bascules répétées. Voir `vue.spec.js:5`.

## **Déjà Présent**

Le toggle accessible, le fondu, le partage centre/zoom, les ajouts/suppressions WMTS et les contrôleurs indépendants avec nettoyage forment une base réutilisable.

## **À Arbitrer**

La spécification reste un brouillon : conservation ou destruction de la 3D, restitution de l’orientation, persistance du mode et optimisations de cache ne doivent pas être traitées comme des décisions définitivement arrêtées.

---

TODO
 Les points 1, 2, 3 et 6 sont implémentés. Restent les autres types de couches, les couches protégées, les widgets et la validation navigateur complète.
