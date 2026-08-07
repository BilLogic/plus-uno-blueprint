import { chromium } from '/Users/billguo/.npm/_npx/86704564b6491f37/node_modules/playwright/index.mjs'
const SHELL='/Users/billguo/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'

const LABEL = process.argv[2] ?? 'after'

const browser = await chromium.launch({ executablePath: SHELL })
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)

const click = async (name) => {
  await page.getByRole('button', { name, exact: true }).first().click()
  await page.waitForTimeout(2200)
}

// ---- in-page helpers -------------------------------------------------------
const HELPERS = () => {
  window.__arrowAudit = {
    arrowPaths() {
      return [...document.querySelectorAll('svg[shape-rendering="geometricPrecision"]')]
        .flatMap((svg, si) =>
          [...svg.querySelectorAll('path[d]')].map((el, pi) => ({ el, si, pi })),
        )
    },
    visibleCellBoxes() {
      const boxes = []
      for (const cell of document.querySelectorAll('[data-blueprint-cell]')) {
        if (!cell.offsetParent && getComputedStyle(cell).position !== 'fixed') continue
        const anchors = cell.querySelectorAll('[data-blueprint-cell-anchor]')
        const rects = (anchors.length ? [...anchors] : [cell]).map((el) => el.getBoundingClientRect())
        const usable = rects.filter((r) => r.width > 1 && r.height > 1)
        if (!usable.length) continue
        boxes.push({
          id: cell.getAttribute('data-blueprint-cell'),
          left: Math.min(...usable.map((r) => r.left)),
          right: Math.max(...usable.map((r) => r.right)),
          top: Math.min(...usable.map((r) => r.top)),
          bottom: Math.max(...usable.map((r) => r.bottom)),
        })
      }
      return boxes
    },
    pointAt(el, ctm, len) {
      const p = el.getPointAtLength(len)
      return { x: ctm.a * p.x + ctm.c * p.y + ctm.e, y: ctm.b * p.x + ctm.d * p.y + ctm.f }
    },
    sideOf(el) {
      const ctm = el.getScreenCTM()
      if (!ctm) return null
      const L = el.getTotalLength()
      if (L < 4) return null
      const a = this.pointAt(el, ctm, 0)
      const b = this.pointAt(el, ctm, L)
      const m = this.pointAt(el, ctm, L / 2)
      // Same-column bracket only: both ends on the same edge of one column,
      // vertically apart, with the run bulging out past them into a gutter.
      if (Math.abs(a.x - b.x) > 60) return 'other'
      if (Math.abs(a.y - b.y) < 20) return 'other'
      if (m.x < Math.min(a.x, b.x) - 4) return 'left'
      if (m.x > Math.max(a.x, b.x) + 4) return 'right'
      return 'inline'
    },
  }
}

// ---- crossing audit --------------------------------------------------------
const crossingAudit = async (name) => {
  const result = await page.evaluate(() => {
    const A = window.__arrowAudit
    const boxes = A.visibleCellBoxes()
    // Endpoints legitimately sit on a card edge; ignore the chevron-length tail
    // at each end and require the point to be strictly INSIDE by a margin.
    const END_SKIP = 20
    const INSET = 2
    const STEP = 2
    const crossings = []
    let sampled = 0
    for (const { el, si, pi } of A.arrowPaths()) {
      const ctm = el.getScreenCTM()
      if (!ctm) continue
      const L = el.getTotalLength()
      if (L <= END_SKIP * 2) continue
      for (let len = END_SKIP; len <= L - END_SKIP; len += STEP) {
        const p = A.pointAt(el, ctm, len)
        sampled++
        for (const box of boxes) {
          if (
            p.x > box.left + INSET && p.x < box.right - INSET &&
            p.y > box.top + INSET && p.y < box.bottom - INSET
          ) {
            crossings.push({ si, pi, cell: box.id, at: Math.round(len), d: el.getAttribute('d').slice(0, 90) })
            len = L
            break
          }
        }
      }
    }
    return { paths: A.arrowPaths().length, sampled, crossings }
  })
  console.log(`[${LABEL}] CROSSINGS ${name}: paths=${result.paths} samples=${result.sampled} crossings=${result.crossings.length}`)
  for (const c of result.crossings.slice(0, 8)) {
    console.log(`   svg${c.si}/path${c.pi} inside cell ${c.cell} @${c.at}px  d=${c.d}`)
  }
  return result.crossings.length
}

// ---- forced-reflow cost ----------------------------------------------------
const perfProbe = async (name) => {
  const out = await page.evaluate(async () => {
    const orig = Element.prototype.getBoundingClientRect
    let calls = 0
    Element.prototype.getBoundingClientRect = function () { calls++; return orig.apply(this, arguments) }
    const frame = () => new Promise((r) => requestAnimationFrame(r))
    await frame(); await frame()
    calls = 0
    const t0 = performance.now()
    window.dispatchEvent(new Event('resize'))
    await frame(); await frame(); await frame()
    const ms = performance.now() - t0
    const resizeCalls = calls

    // A pure scroll used to rebuild every route; now it must not.
    calls = 0
    const scroller = document.scrollingElement
    const target = document.querySelector('[data-blueprint-cell]')?.closest('div[class*="overflow"]') ?? scroller
    target.scrollTop += 40
    target.dispatchEvent(new Event('scroll'))
    await frame(); await frame(); await frame()
    const scrollCalls = calls

    Element.prototype.getBoundingClientRect = orig
    return { resizeCalls, ms: Math.round(ms * 10) / 10, scrollCalls }
  })
  console.log(`[${LABEL}] PERF ${name}: getBoundingClientRect/full-update=${out.resizeCalls} (${out.ms}ms), per-scroll=${out.scrollCalls}`)
  return out
}

// ---- side stability across fold toggles ------------------------------------
const hysteresisProbe = async (name) => {
  const foldButton = page.locator('button[aria-label^="Fold "], button[aria-label="Unfold shared steps"]').first()
  if (await foldButton.count() === 0) {
    console.log(`[${LABEL}] HYSTERESIS ${name}: no fold control`)
    return null
  }

  const startSampling = () =>
    page.evaluate(() => {
      window.__sides = new Map()
      window.__flips = 0
      window.__stop = false
      const tick = () => {
        for (const { el, si, pi } of window.__arrowAudit.arrowPaths()) {
          const side = window.__arrowAudit.sideOf(el)
          if (side !== 'left' && side !== 'right') continue
          const key = `${si}/${pi}`
          const prev = window.__sides.get(key)
          if (prev && prev !== side) window.__flips++
          window.__sides.set(key, side)
        }
        if (!window.__stop) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

  await startSampling()
  for (let i = 0; i < 6; i++) {
    await foldButton.click()
    await page.waitForTimeout(900)
  }
  const flips = await page.evaluate(() => {
    window.__stop = true
    return { flips: window.__flips, tracked: window.__sides.size }
  })
  console.log(`[${LABEL}] HYSTERESIS ${name}: 6 fold toggles, bracket connectors tracked=${flips.tracked}, side flips=${flips.flips}`)
  return flips
}


// ---- targeted hysteresis probe --------------------------------------------
// Blocks the gutter a bracket connector is using, then unblocks it. A monotone
// router flips back the instant the obstruction clears; a sticky one keeps the
// side it moved to. Sides observed: [initial, blocked, unblocked].
const blockerProbe = async (name) => {
  const trace = await page.evaluate(async () => {
    const A = window.__arrowAudit
    const frame = () => new Promise((r) => requestAnimationFrame(r))
    const settle = async () => {
      window.dispatchEvent(new Event('resize'))
      for (let i = 0; i < 4; i++) await frame()
    }
    const sides = () =>
      A.arrowPaths().map(({ el }) => A.sideOf(el))

    const makeBlocker = (x, y) => {
      const b = document.createElement('div')
      b.setAttribute('data-blueprint-cell', '__probe-blocker')
      b.style.cssText = `position:absolute;left:${x - 14}px;top:${y - 30}px;width:28px;height:60px;pointer-events:none;`
      const a = document.createElement('div')
      a.setAttribute('data-blueprint-cell-anchor', '')
      a.style.cssText = 'position:absolute;inset:0;'
      b.appendChild(a)
      return b
    }

    const brackets = A.arrowPaths().filter(({ el }) => {
      const s = A.sideOf(el)
      return s === 'left' || s === 'right'
    })

    const report = []
    for (const { el } of brackets.slice(0, 12)) {
      const side0 = A.sideOf(el)
      const ctm = el.getScreenCTM()
      const mid = A.pointAt(el, ctm, el.getTotalLength() / 2)
      const root = el.closest('svg').parentElement
      const rootRect = root.getBoundingClientRect()
      const blocker = makeBlocker(mid.x - rootRect.left, mid.y - rootRect.top)
      root.appendChild(blocker)
      await settle()
      const side1 = el.isConnected ? A.sideOf(el) : 'gone'
      blocker.remove()
      await settle()
      const side2 = el.isConnected ? A.sideOf(el) : 'gone'
      report.push(`${side0}>${side1}>${side2}`)
    }
    return { report }
  })
  if (!trace) {
    console.log(`[${LABEL}] BLOCKER ${name}: no bracket connectors`)
    return
  }
  const flipBacks = trace.report.filter((r) => {
    const [a, b, c] = r.split('>')
    return b !== a && c === a
  }).length
  console.log(`[${LABEL}] BLOCKER ${name}: initial>blocked>cleared per connector: ${trace.report.join(' , ')}`)
  console.log(`[${LABEL}] BLOCKER ${name}: moved-then-flipped-back = ${flipBacks} of ${trace.report.length}`)
}


// ---- unit-level side-stickiness probe --------------------------------------
// Drives resolveSameColumnSideRoute directly against real cells: resolve, block
// the gutter it chose, resolve again, unblock, resolve again.
const unitProbe = async (name) => {
  const out = await page.evaluate(async () => {
    const mod = await import('/src/lib/blueprintArrowGeometry.ts')
    const roots = [...document.querySelectorAll('svg[shape-rendering="geometricPrecision"]')]
      .map((svg) => svg.parentElement)
    const seen = new Set()
    const results = []

    for (const root of roots) {
      if (seen.has(root)) continue
      seen.add(root)
      const cells = [...root.querySelectorAll('[data-blueprint-cell]')].filter(
        (el) => el.getBoundingClientRect().height > 4,
      )
      const byStep = new Map()
      for (const el of cells) {
        const k = el.dataset.stepIndex
        if (k === undefined) continue
        if (!byStep.has(k)) byStep.set(k, [])
        byStep.get(k).push(el)
      }
      for (const group of byStep.values()) {
        for (let i = 0; i < group.length && results.length < 8; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i]
            const b = group[j]
            if (a.contains(b) || b.contains(a)) continue
            const first = mod.resolveSameColumnSideRoute(a, b, root)
            if (!first) continue

            const boxA = mod.getCellContentBox(a, root)
            const boxB = mod.getCellContentBox(b, root)
            const yA = boxA.top + boxA.height / 2
            const yB = boxB.top + boxB.height / 2
            const blocker = document.createElement('div')
            blocker.setAttribute('data-blueprint-cell', '__probe-blocker')
            blocker.style.cssText = `position:absolute;left:${first.gutterX - 6}px;top:${Math.min(yA, yB) - 4}px;width:12px;height:${Math.abs(yA - yB) + 8}px;pointer-events:none;`
            const anchor = document.createElement('div')
            anchor.setAttribute('data-blueprint-cell-anchor', '')
            anchor.style.cssText = 'position:absolute;inset:0;'
            blocker.appendChild(anchor)
            root.appendChild(blocker)

            const blocked = mod.resolveSameColumnSideRoute(a, b, root)
            blocker.remove()
            const cleared = mod.resolveSameColumnSideRoute(a, b, root)

            results.push({
              initial: first.side,
              blocked: blocked ? blocked.side : 'none',
              cleared: cleared ? cleared.side : 'none',
            })
            break
          }
        }
      }
      if (results.length >= 8) break
    }
    return results
  })

  if (!out.length) {
    console.log(`[${LABEL}] UNIT ${name}: no resolvable same-column pair`)
    return
  }
  const moved = out.filter((r) => r.blocked !== r.initial && r.blocked !== 'none')
  const flippedBack = moved.filter((r) => r.cleared === r.initial).length
  console.log(
    `[${LABEL}] UNIT ${name}: ${out.map((r) => `${r.initial}>${r.blocked}>${r.cleared}`).join(' , ')}`,
  )
  console.log(
    `[${LABEL}] UNIT ${name}: moved-when-blocked=${moved.length}/${out.length}, of those flipped back when cleared=${flippedBack}`,
  )
}

await page.addInitScript(HELPERS)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(3500)

let totalCrossings = 0

// 1. Application / Discovery
await click('Application')
await click('Discovery')
totalCrossings += await crossingAudit('Application/Discovery')
await perfProbe('Application/Discovery')

// 2. In-session / Warm-Up, Happy + Alternate, Stacked then Merged
await click('In-session')
await click('Warm-Up')
const alternate = page.getByRole('button', { name: 'Alternate Path', exact: true }).first()
if ((await alternate.getAttribute('aria-pressed')) === 'false') {
  await alternate.click()
  await page.waitForTimeout(2500)
}

for (const view of ['Stacked', 'Merged']) {
  await page.getByRole('button', { name: view, exact: true }).first().click()
  await page.waitForTimeout(2500)
  totalCrossings += await crossingAudit(`In-session/Warm-Up ${view}`)
  await perfProbe(`In-session/Warm-Up ${view}`)
  await hysteresisProbe(`In-session/Warm-Up ${view}`)
  await blockerProbe(`In-session/Warm-Up ${view}`)
  await unitProbe(`In-session/Warm-Up ${view}`)
  totalCrossings += await crossingAudit(`In-session/Warm-Up ${view} (post-toggles)`)
}

console.log(`[${LABEL}] TOTAL CROSSINGS: ${totalCrossings}`)
console.log(`[${LABEL}] console errors: ${consoleErrors.length}`, consoleErrors.slice(0, 5).join(' || '))
await browser.close()
