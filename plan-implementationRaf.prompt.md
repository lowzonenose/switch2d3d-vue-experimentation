Le plan est prêt. **Le mode Plan est actif : aucun code n’a encore été modifié.**

**Décisions Retenues**
- Conserver la 3D en mémoire et la suspendre en 2D.
- Migrer entièrement vers les descripteurs, sans compatibilité `layerIds`.
- Recevoir le jeton Bearer par callback du projet hôte.

**Plan D’exécution**
1. **Modèle des couches — RaF 1**  
   Modifier [state.js](src/maps/state.js) et les stores : descripteurs complets, validation, visibilité, opacité et déplacement dans l’ordre. Migrer les appels et tests existants.

2. **Adaptateurs et types — RaF 1 et 4**  
   Faire réconcilier les descripteurs par [createMap2D.js](src/maps/createMap2D.js) et [createMap3D.js](src/maps/createMap3D.js). Prendre en charge WMTS/WMS et conserver les couches incompatibles avec un rapport explicite.  
   *Dépend de l’étape 1.*

3. **Accès protégés — RaF 5**  
   Ajouter un transport HTTP commun avec fournisseur de jeton injecté, contrôle des origines et annulation. Pour les textures iTowns, utiliser un chargement authentifié spécifique : les seuls `networkOptions.headers` ne suffisent pas.  
   *Après l’étape 2, parallélisable avec l’étape 4.*

4. **Orchestration et chargement différé — RaF 2, 3 et 6**  
   Créer `useMapMode` : import dynamique, disponibilité, chargement, erreurs, nouvelle tentative et nettoyage. Garder la 2D interactive jusqu’au premier rendu 3D valide. Réserver les remontées de navigation à la vue active.

5. **Suspension et reprise — RaF 6**  
   Suspendre les observations, interactions et rendu du moteur caché. À la reprise, appliquer le dernier état avant le fondu. Vérifier cette suspension sur le moteur réel, sans modifier ses champs internes.  
   *Intégrée à l’étape 4.*

6. **Widgets DSFR — RaF 7**  
   Remplacer les gestionnaires indépendants par une interface commune : couches, zoom, plein écran, coordonnées, échelle et minimap. Réutiliser les thèmes DSFR fournis par les extensions. Les composants ne manipuleront pas les moteurs directement.  
   *Après les étapes 2 et 4.*

7. **Validation — RaF 8**  
   Étendre Vitest et Playwright Chromium/WebKit : chargement différé, repli, changements de couches, authentification, clavier, équivalence d’échelle et dix bascules successives. Mesurer le nettoyage et les ressources ; de simples tests simulés ne suffiront pas.

8. **Documentation et suivi**  
   Actualiser [src/maps/README.md](src/maps/README.md) et cocher [RaF.md](RaF.md) uniquement après validation de chaque point.

**Critères De Fin**
- Suite unitaire complète, lint et compilation réussis.
- Aucun chargement iTowns avant la première demande 3D.
- Tests navigateur avec moteurs réels et tuiles locales contrôlées.
- Limites Safari et mémoire explicitement documentées lorsqu’elles ne peuvent pas être vérifiées.

Le plan détaillé, ses dépendances et ses tâches sont enregistrés pour le passage en mode implémentation.
