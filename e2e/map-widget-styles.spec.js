import { test, expect } from '@playwright/test'

async function mapStyleScopes(page) {
  return page.locator('body').evaluate(() => {
    function selectors(rules) {
      return [...rules].flatMap((rule) => rule.selectorText
        ? [rule.selectorText]
        : rule.cssRules ? selectors(rule.cssRules) : [])
    }
    const rules = [...document.styleSheets].flatMap((sheet) => selectors(sheet.cssRules))
    return {
      has2D: rules.some((selector) => selector.includes(':where(.map2d)')),
      has3D: rules.some((selector) => selector.includes(':where(.map3d)')),
    }
  })
}

async function widgetStyles(map) {
  return map.locator('[class*="GP"], [id^="GP"], .ol-scale-line').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element)
      const properties = [
        'width', 'height', 'font-size', 'font-family', 'color',
        'background-color', 'background-image', 'background-position',
        'position', 'top', 'right', 'bottom', 'left', 'padding',
        'border-radius', 'box-shadow', 'box-sizing',
      ]
      return {
        id: element.id,
        className: element.className,
        style: Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)])),
      }
    }),
  )
}

test('preserves 2D widget styles after loading and revisiting 3D', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/switch2d3d-vue-experimentation/about')
  expect(await mapStyleScopes(page)).toEqual({ has2D: false, has3D: false })

  await page.goto('/switch2d3d-vue-experimentation/experimentation')
  const toggle = page.getByRole('switch', { name: 'Vue 3D' })
  await expect(toggle).toBeEnabled({ timeout: 30000 })
  const map2D = page.locator('#map2d')
  const panel2D = map2D.locator('[id^="GPlayersList-"]')
  await expect(panel2D).toHaveCount(1)
  await map2D.locator('[id^="GPshowLayersListPicto-"]').click()
  await expect(panel2D).toBeVisible()
  await toggle.hover()
  const before = await widgetStyles(map2D)
  expect(before.length).toBeGreaterThan(0)
  await expect(page.locator('#map3d')).toHaveCount(0)
  expect(await mapStyleScopes(page)).toEqual({ has2D: true, has3D: false })

  const outsideWidget = await page.evaluate(() => {
    const widget = document.createElement('div')
    widget.className = 'GPwidget GPpanel'
    widget.dataset.testid = 'outside-map-widget'
    document.body.append(widget)
    const style = getComputedStyle(widget)
    return { position: style.position, boxShadow: style.boxShadow, fontSize: style.fontSize }
  })
  expect(outsideWidget.position).toBe('static')
  expect(outsideWidget.boxShadow).toBe('none')

  for (let cycle = 0; cycle < 2; cycle++) {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 45000 })
    expect(await mapStyleScopes(page)).toEqual({ has2D: true, has3D: true })
    const map3D = page.locator('#map3d')
    const panel3D = map3D.locator('[id^="GPlayersList-"]')
    await expect(panel3D).toHaveCount(1)
    await expect(panel3D).toHaveCSS('box-shadow', 'rgb(0, 0, 0) 0px 0px 6px 0px')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(map2D).not.toHaveClass(/map-hidden/)
    await expect(panel2D).toBeVisible()
    expect(await widgetStyles(map2D)).toEqual(before)
    expect(await page.getByTestId('outside-map-widget').evaluate((element) => {
      const style = getComputedStyle(element)
      return { position: style.position, boxShadow: style.boxShadow, fontSize: style.fontSize }
    })).toEqual(outsideWidget)
  }
  await page.getByTestId('outside-map-widget').evaluate((element) => element.remove())
})
