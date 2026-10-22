# switch2d3d-vue-experimentation

Ce modèle vous aide à démarrer le développement avec Vue 3 et Vite.

## Module cartographique réutilisable

Le [module cartographique](src/maps/README.md) fournit des contrôleurs 2D/3D
propres à chaque instance, un état réactif configurable et le chargement du catalogue,
sans dépendre de Pinia ni des alias de l'application. Sa documentation inclut un
exemple d'intégration dans un autre projet Vue.

### Composants cartographiques Vue

[Map2D](src/components/Map2D.vue) et [Map3D](src/components/Map3D.vue) encapsulent
l'élément cible de chaque carte et le cycle de vie de son contrôleur. Transmettez
les options du contrôleur (`layers`, `controls`, `view` et les paramètres facultatifs
du moteur) via la prop obligatoire `options`. Les options sont lues à la création
du composant ; les objets d'état restent réactifs.

Une fois la configuration prête, appelez la méthode exposée `load()` via une
référence de template. Elle renvoie la promesse de chargement du contrôleur et
propage les erreurs à l'appelant. Chaque composant libère automatiquement les
ressources de son contrôleur avant son démontage.

[TheExperimentation](src/components/TheExperimentation.vue) coordonne la configuration
et le chargement séquentiel (2D puis 3D), et gère la mise en page, les transitions
et la visibilité. Les deux composants cartographiques restent montés lors du
changement de vue.

## Bouton de bascule 2D/3D réutilisable

[ButtonToggle2D3D](src/components/ButtonToggle2D3D.vue) est un composant Vue autonome,
sans dépendance aux cartes ni aux stores. Liez un booléen avec `v-model` (`false`
pour la 2D, `true` pour la 3D ; la valeur par défaut est `false`). Le parent reste
responsable de l'affichage de la carte sélectionnée. Le composant inclut ses styles
et la sémantique d'accessibilité d'un interrupteur.

```vue
<script setup>
import { ref } from 'vue'
import ButtonToggle2D3D from './src/components/ButtonToggle2D3D.vue'

const is3D = ref(false)
</script>

<template>
  <ButtonToggle2D3D v-model="is3D" aria-controls="map2d map3d" />
</template>
```

Renseignez `aria-controls` avec les identifiants des cartes contrôlées par cette
instance. Les attributs natifs du bouton, tels que `disabled` et un `aria-label`
personnalisé, sont également pris en charge.

## Configuration recommandée de l'IDE

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (désactivez Vetur).

## Configuration recommandée du navigateur

- Navigateurs basés sur Chromium (Chrome, Edge, Brave, etc.) :
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Activer le formatage personnalisé des objets dans Chrome DevTools](http://bit.ly/object-formatters)
- Firefox :
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Activer le formatage personnalisé des objets dans les outils de développement Firefox](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Personnalisation de la configuration

Consultez la [référence de configuration de Vite](https://vite.dev/config/).

## Installation du projet

```sh
npm install
```

### Compilation et rechargement à chaud pour le développement

```sh
npm run dev
```

### Compilation et minification pour la production

```sh
npm run build
```

### Exécution des tests unitaires avec [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Exécution des tests de bout en bout avec [Playwright](https://playwright.dev)

```sh
# Installer les navigateurs avant la première exécution
npx playwright install

# En intégration continue, compiler le projet avant les tests
npm run build

# Exécuter les tests de bout en bout
npm run test:e2e
# Exécuter les tests uniquement sur Chromium
npm run test:e2e -- --project=chromium
# Exécuter les tests d'un fichier précis
npm run test:e2e -- tests/example.spec.ts
# Exécuter les tests en mode débogage
npm run test:e2e -- --debug
```

### Analyse du code avec [ESLint](https://eslint.org/)

```sh
npm run lint
```
