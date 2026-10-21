# Comparer l’implémentation à la spécification du dépôt

puis lister les écarts avec les modifications nécessaires.

**Non, pas entièrement.** L’implémentation constitue un prototype fonctionnel, mais ne couvre pas encore la v1 décrite dans la spécification.

Les premiers écarts sont nets :

- la 3D est chargée dès l’ouverture de la page, et le store ne décrit que les identifiants des couches, sans visibilité, opacité ni ordre.

- Le bouton et la synchronisation de base sont présents, mais plusieurs exigences « Must » restent absentes.

## **Écarts Prioritaires**

- [ ] 1. **Synchronisation des couches incomplète — FR-003, FR-005, FR-014.**  
   Le store conserve uniquement des identifiants. Visibilité, opacité et ordre ne sont pas synchronisés. Remplacer cette liste par des descripteurs `{ id, type, visible, opacity, order, source }`, puis réconcilier ces propriétés dans chaque moteur. Voir `state.js:20`.

- [ ] 2. **Chargement 3D non différé — NFR-001, ADR-003.**  
   iTowns est importé statiquement et le globe est créé au montage, même si l’utilisateur reste en 2D. Ajouter un import dynamique au premier passage en 3D. Voir `index.js:2` et `TheExperimentation.vue:36`.

- [ ] 3. **Bascule possible avant disponibilité, sans repli utilisateur — FR-007, FR-008.**  
   Le bouton modifie immédiatement `is3D`. Une initialisation lente ou échouée peut donc masquer la 2D et afficher une vue vide. Attendre que la 3D soit prête, afficher le chargement et conserver la 2D en cas d’erreur, avec un message visible. Voir `TheExperimentation.vue:62`.

- [ ] 4. **Types de couches insuffisamment couverts — FR-004, FR-009.**  
   Les adaptateurs créent uniquement des couches WMTS et le relief. Le WMS, notamment, manque ; les couches incompatibles ne sont pas signalées. Ajouter des convertisseurs par type, `supports()` et un rapport des couches non prises en charge. Voir `createMap3D.js:160`.

- [ ] 5. **Couches protégées non couvertes explicitement — FR-011, NFR-005.**  
   Aucun mécanisme applicatif d’injection de jeton Bearer n’est prévu dans la construction des sources. Ajouter une configuration d’authentification commune aux requêtes des deux moteurs, puis des tests vérifiant les en-têtes et l’absence de jeton dans les URL. Voir `createMap3D.js:161`. Ce constat ne démontre pas une fuite actuelle.

- [ ] 6. **Orchestration différente de l’architecture proposée — ADR-001, ADR-002.**  
   Le composant appelle directement les contrôleurs ; aucun `useMapMode` ne centralise mode, disponibilité, chargement et erreurs. Les deux moteurs remontent aussi leur point de vue sans distinction de vue visible. Ajouter cet orchestrateur et réserver les remontées de navigation au moteur actif. Voir `TheExperimentation.vue:18` et `createMap3D.js:119`.

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
 **le modèle complet des couches**, puis **`useMapMode` avec chargement différé et repli 2D**, avant les widgets et la validation navigateur. Aucun fichier modifié ; tests non relancés pour cette analyse.
