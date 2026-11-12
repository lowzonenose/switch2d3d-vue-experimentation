import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useGetConfig } from './getConfig'

let map3dStyles

// Un lien explicite permet de reessayer apres un echec CSS mis en cache par Vite.
function loadMap3DStyles() {
  if (!map3dStyles) {
    let stylesheet
    map3dStyles = import('@portail/map3d/style.css?url')
      .then(({ default: url }) => new Promise((resolve, reject) => {
        stylesheet = document.createElement('link')
        stylesheet.rel = 'stylesheet'
        stylesheet.href = url
        stylesheet.dataset.map3dStyles = 'true'
        stylesheet.onload = resolve
        stylesheet.onerror = () => reject(new Error(`Impossible de charger les styles 3D : ${url}`))
        document.head.appendChild(stylesheet)
      }))
      .catch((cause) => {
        stylesheet?.remove()
        map3dStyles = null
        throw cause
      })
  }
  return map3dStyles
}

export function useMapMode(options) {
  const map2dRef = ref(null)
  const map3dRef = ref(null)
  const map3DComponent = shallowRef(null)
  const is3D = ref(false)
  const isReady2D = ref(false)
  const isReady3D = ref(false)
  const isLoading2D = ref(true)
  const isLoading3D = ref(false)
  const loadingError = ref(null)
  const isLoading = computed(() => isLoading2D.value || isLoading3D.value)
  const canToggle = computed(() => isReady2D.value && !isLoading.value)
  let disposed = false

  const options2D = {
    ...options,
    isActive: () => !disposed && isReady2D.value && !is3D.value,
  }
  const options3D = {
    ...options,
    isActive: () => !disposed && isReady3D.value && is3D.value,
  }

  onBeforeUnmount(() => {
    disposed = true
  })

  async function setMapMode(value) {
    if (!canToggle.value || disposed) return
    if (!value || isReady3D.value) {
      is3D.value = value
      return
    }

    isLoading3D.value = true
    loadingError.value = null
    try {
      if (!map3DComponent.value) {
        const [{ Map3D }] = await Promise.all([
          import('@portail/map3d'),
          loadMap3DStyles(),
        ])
        if (disposed) return
        map3DComponent.value = Map3D
        await nextTick()
      }
      if (disposed) return
      await map3dRef.value.load()
      if (disposed) return
      isReady3D.value = true
      is3D.value = true
    } catch (cause) {
      console.error('Impossible de charger la carte 3D :', cause)
      if (!disposed) {
        loadingError.value = 'Impossible de charger la carte 3D. Vous pouvez réessayer.'
      }
    } finally {
      isLoading3D.value = false
    }
  }

  onMounted(async () => {
    try {
      await useGetConfig()
    } catch (cause) {
      console.error('Impossible de charger la configuration des cartes :', cause)
      if (!disposed) {
        loadingError.value = 'Impossible de charger la configuration des cartes.'
        isLoading2D.value = false
      }
      return
    }
    if (disposed) return
    await nextTick()
    if (disposed) return
    try {
      await map2dRef.value.load()
      if (!disposed) isReady2D.value = true
    } catch (cause) {
      console.error('Impossible de charger la carte 2D :', cause)
      if (!disposed) loadingError.value = 'Impossible de charger la carte 2D.'
    } finally {
      isLoading2D.value = false
    }
  })

  return {
    map2dRef,
    map3dRef,
    map3DComponent,
    options2D,
    options3D,
    is3D,
    isReady2D,
    isReady3D,
    isLoading2D,
    isLoading3D,
    isLoading,
    canToggle,
    loadingError,
    setMapMode,
  }
}
