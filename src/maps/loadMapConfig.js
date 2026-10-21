import Gp from 'geoportal-access-lib'

const DEFAULT_CONFIG_URL = 'https://raw.githubusercontent.com/IGNF/geoportal-configuration/new-url/dist/fullConfig.json'

export function loadMapConfig({ url = DEFAULT_CONFIG_URL, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const config = new Gp.Services.Config({
      customConfigFile: url,
      timeOut: timeout,
      onSuccess: resolve,
      onFailure: reject,
    })
    config.call()
  })
}
