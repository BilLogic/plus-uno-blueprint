// @vitest-environment jsdom
/**
 * Every definition in the app opens the same way and looks the same, and
 * nothing on the resting page announces one (#243).
 *
 * The card's own seam is the CARD. "One section and two sections are typeset
 * identically" is the assertion that stops the pattern drifting back into two
 * shapes — it is exactly what had drifted: the category half wore a small-caps
 * eyebrow and the instance half a plain medium-weight name, inside one card,
 * on the three surfaces that render both.
 *
 * What is rendered and what is read as text, and why:
 *
 *   - the card, the three two-section surfaces, `StatusBadge` and the two
 *     made-up words' `Field` labels are RENDERED, because the claims are about
 *     what a reader sees and in what order;
 *   - "no cue and no ⓘ survive" is read as TEXT, because it is a claim about
 *     the whole tree and no single render can observe an absence everywhere.
 *     Prior art for the source-reading half: `stakeholderDefinitionReader.test.ts`.
 */
import type { ReactElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DefinitionCard,
  DefinitionPopover,
} from '@/components/blueprint/DefinitionCard'
import { EntityDefinitionPopover } from '@/components/blueprint/EntityDefinitionPopover'
import { EntityTitleAffordance } from '@/components/blueprint/EntityTitleAffordance'
import { BlueprintDividerRailLabel } from '@/components/blueprint/BlueprintDividerBadge'
import { PanelSectionLabel } from '@/components/blueprint/PanelSectionLabel'
import { Field } from '@/components/blueprint/panelShell'
import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import { ScenarioTitleBadge } from '@/components/blueprint/ScenarioTitleBadge'
import { StakeholderBadge } from '@/components/blueprint/StakeholderBadge'
import { StatusBadge } from '@/components/blueprint/StatusBadge'
import { ENTITY_STATUS_MEANING } from '@/lib/entityStatus'
import {
  STAKEHOLDER_KIND_LABELS,
  STAKEHOLDER_KIND_MEANING,
  type StakeholderKind,
} from '@/hooks/useStakeholders'
import {
  ENTITY_EXAMPLE_PLACEHOLDER,
  ENTITY_KIND_DEFINITIONS,
  PANEL_TERMS,
} from '@/lib/panelTerms'
import { CanvasModeContext } from '@/contexts/canvasModeContext'
import { EntityExamplesContext } from '@/contexts/EntityExamplesContext'

afterEach(cleanup)

/* --------------------------------------------------------- opening one */

/**
 * Hover, as Base UI actually learns it.
 *
 * Base UI's hover interaction is `mouseOnly`: it decides from a pointer type
 * it records on React's `onPointerEnter`, and React synthesises that handler
 * from `pointerover` rather than `pointerenter`. A `mouseOver` alone leaves
 * the pointer type unset, `isMouseLikePointerType` rejects it under `strict`,
 * and the popover never opens — which reads in a test exactly like a broken
 * component. The working sequence is pointerover → mouseenter → mousemove.
 *
 * jsdom has no `PointerEvent`, so the first one is a `MouseEvent` with the
 * property attached; Base UI reads `event.pointerType` and nothing else.
 */
function hover(element: Element) {
  // The TRIGGER, not whatever text node was queried. A badge sets its name in
  // an inner `<span>`, and `mouseenter` does not bubble — so hovering the
  // inner span delivers two of the three events and the popover never opens.
  const trigger =
    element.closest('[tabindex], [role="button"], button') ?? element
  const pointerOver = new MouseEvent('pointerover', {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(pointerOver, 'pointerType', { value: 'mouse' })
  trigger.dispatchEvent(pointerOver)
  fireEvent.mouseEnter(trigger)
  fireEvent.mouseMove(trigger)
}

/*
  The card is marked with `data-definition-card` rather than a test id, so the
  attribute a stylesheet or a future guard would read is the one this file
  reads. Testing Library has no query for an attribute, hence the selectors.
*/
const sections = (card: HTMLElement) =>
  Array.from(card.querySelectorAll('[data-definition-section]'))

const eyebrow = (section: Element) =>
  section.querySelector('[data-definition-eyebrow]') as HTMLElement

const body = (section: Element) =>
  section.querySelector('[data-definition-body]') as HTMLElement

/* -------------------------------------------------- the card is one shape */

describe('the definition card', () => {
  const one = [{ eyebrow: 'Path', body: ENTITY_KIND_DEFINITIONS.path.definition }]
  const two = [
    ...one,
    { eyebrow: 'Happy Path', body: 'The student joins on time.' },
  ]

  it('sets a category and an instance identically — one shape, not two', () => {
    render(<DefinitionCard sections={two} />)
    const card = document.querySelector('[data-definition-card]') as HTMLElement
    const [category, instance] = sections(card)

    // The assertion this file exists for. The instance used to head itself
    // with a plain medium-weight name while the category wore a small-caps
    // eyebrow: two heading treatments inside one card.
    expect(eyebrow(instance).className).toBe(eyebrow(category).className)
    expect(body(instance).className).toBe(body(category).className)
  })

  it('sets a one-section card exactly as it sets a two-section one', () => {
    render(<DefinitionCard sections={one} />)
    const alone = sections(
      document.querySelector('[data-definition-card]') as HTMLElement,
    )[0]
    const aloneClasses = [eyebrow(alone).className, body(alone).className]
    cleanup()

    render(<DefinitionCard sections={two} />)
    const paired = sections(
      document.querySelector('[data-definition-card]') as HTMLElement,
    )
    for (const section of paired) {
      expect([eyebrow(section).className, body(section).className]).toEqual(
        aloneClasses,
      )
    }
  })

  it('separates sections with a hairline and never heads one with it', () => {
    render(<DefinitionCard sections={two} />)
    const [first, second] = sections(
      document.querySelector('[data-definition-card]') as HTMLElement,
    )
    expect(first.className).not.toContain('border-t')
    expect(second.className).toContain('border-t')
  })
})

/* ------------------------------------------------ every definition opens */

describe('a definition opens on hover, and is reachable without a pointer', () => {
  it('opens the card on hover', async () => {
    render(
      <DefinitionPopover sections={[{ eyebrow: 'Lane', body: 'One row.' }]}>
        <span>Front stage</span>
      </DefinitionPopover>,
    )
    hover(screen.getByText('Front stage'))
    expect(await screen.findByText('One row.')).toBeDefined()
  })

  it('gives the trigger a tab stop, so focus reaches it', () => {
    render(
      <DefinitionPopover sections={[{ eyebrow: 'Lane', body: 'One row.' }]}>
        <span>Front stage</span>
      </DefinitionPopover>,
    )
    const trigger = screen.getByText('Front stage')
    expect(trigger.getAttribute('tabindex')).toBe('0')
    trigger.focus()
    expect(document.activeElement).toBe(trigger)
  })
})

/* ----------------------------------------- the three two-section surfaces */

describe('the surfaces that show a category and an instance', () => {
  const rendered: Array<[string, () => void, string]> = [
    [
      'a path badge',
      () =>
        render(
          <PathLabelBadge
            name="Happy Path"
            summary="The student joins on time."
            pathKind="happy"
          />,
        ),
      'Happy Path',
    ],
    [
      'a scenario title badge',
      () =>
        render(
          <ScenarioTitleBadge name="Warm-Up" summary="The first minutes." />,
        ),
      'Warm-Up',
    ],
    [
      'a stakeholder badge',
      () =>
        render(
          <StakeholderBadge
            name="Regular Tutor"
            kind="staff"
            summary="The tutor a student sees every week."
          />,
        ),
      'Regular Tutor',
    ],
  ]

  it.each(rendered)('%s renders two identically set sections', async (_name, mount, label) => {
    mount()
    hover(screen.getByText(label))
    const card = await screen.findByText(label, {
      selector: '[data-definition-eyebrow]',
    })
    const parts = sections(
      card.closest('[data-definition-card]') as HTMLElement,
    )
    expect(parts).toHaveLength(2)
    expect(eyebrow(parts[1]).className).toBe(eyebrow(parts[0]).className)
    expect(body(parts[1]).className).toBe(body(parts[0]).className)
  })
})

/* ------------------------------------------------- the stakeholder card */

describe('the stakeholder card', () => {
  it('shows the kind, that kind meaning, then the name and its summary', async () => {
    render(
      <StakeholderBadge
        name="Regular Tutor"
        kind="staff"
        summary="The tutor a student sees every week."
      />,
    )
    hover(screen.getByText('Regular Tutor'))
    const first = await screen.findByText(STAKEHOLDER_KIND_LABELS.staff, {
      selector: '[data-definition-eyebrow]',
    })
    const card = first.closest('[data-definition-card]') as HTMLElement
    const [kind, instance] = sections(card)

    expect(eyebrow(kind).textContent).toBe('Staff')
    expect(body(kind).textContent).toBe(STAKEHOLDER_KIND_MEANING.staff)
    expect(eyebrow(instance).textContent).toBe('Regular Tutor')
    expect(body(instance).textContent).toBe(
      'The tutor a student sees every week.',
    )
  })

  it('has a meaning for all five kinds, and says a team owns a lane and is never one', () => {
    const kinds: StakeholderKind[] = [
      'recipient',
      'staff',
      'partner',
      'provider',
      'team',
    ]
    for (const kind of kinds) {
      // Long enough to be a definition rather than a restated label — the
      // floor `scripts/tests/entity-definitions.test.mjs` applies to the
      // entity kinds, for the same reason.
      expect(STAKEHOLDER_KIND_MEANING[kind].length, kind).toBeGreaterThan(40)
    }
    // The one sentence carrying the schema: a team reaches a lane through
    // `owner_team` and is never its `stakeholder_id`, because Design does not
    // stand in a room. If this is ever wrong, the schema is wrong with it.
    expect(STAKEHOLDER_KIND_MEANING.team).toMatch(/owns a lane and is never one/)
  })
})

/* ------------------------------------------------------- the status badge */

describe('StatusBadge', () => {
  it('discloses what the status means, in a card and not a tooltip', async () => {
    render(<StatusBadge status="built" />)
    hover(screen.getByText('Built'))
    expect(await screen.findByText(ENTITY_STATUS_MEANING.built)).toBeDefined()
    expect(document.querySelector('[data-definition-card]')).not.toBeNull()
  })

  it('is reachable by keyboard focus', () => {
    render(<StatusBadge status="live" />)
    const badge = screen.getByText('Live')
    expect(badge.getAttribute('tabindex')).toBe('0')
    badge.focus()
    expect(document.activeElement).toBe(badge)
  })
})

describe('a made-up word is a plain field label, and still explains itself', () => {
  /*
    #244 kept exactly two made-up words — `Touchpoint`, `Storyboard` — and
    rendered each as an outline badge, on the reasoning that a badge is the
    shape a vocabulary word wears. #307 reopens that for these two: stacked
    among a cell's value badges, the caption read as a mystery tag rather than
    a field label, so both become plain `Field` labels beside Summary and
    Status. The definition does not vanish — it moves onto the label's own hint
    popover, the touch/press affordance every other field label already uses.

    What is asserted is what a reader can reach: the caption is a plain label,
    not a badge, and hovering it still discloses the definition.
  */
  it('Touchpoint is a plain label, not a badge, and hovering it gives the definition', async () => {
    render(
      <Field label="Touchpoint" hint={PANEL_TERMS.touchpoint}>
        <span>a value</span>
      </Field>,
    )
    const label = screen.getByText('Touchpoint')
    expect(label.hasAttribute('data-panel-term-badge')).toBe(false)
    hover(label)
    expect(await screen.findByText(PANEL_TERMS.touchpoint)).not.toBeNull()
  })

  it('an ordinary section label discloses nothing at all', async () => {
    // `Status` names a field holding a status. A sentence saying so helped
    // nobody, and there were eight more like it.
    render(<PanelSectionLabel>Status</PanelSectionLabel>)
    const label = screen.getByText('Status')
    expect(label.hasAttribute('tabindex')).toBe(false)
    hover(label)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('[data-definition-card]')).toBeNull()
  })

  it('a divider is an outlined block, and says what its line separates', async () => {
    // The three divider lines are the whole grammar of a service blueprint,
    // and the rail stated them in the same register as every other row label.
    render(<BlueprintDividerRailLabel label="line of interaction" />)
    const block = screen.getByText('line of interaction')
    expect(block.hasAttribute('data-blueprint-row-header')).toBe(true)
    expect(block.className).toContain('uppercase')
    hover(block)
    expect(
      await screen.findByText(/Above it, what the customer does/),
    ).not.toBeNull()
  })

  it('the term map holds only the words a reader could not guess', () => {
    // The check that keeps the pass from being undone one entry at a time.
    expect(Object.keys(PANEL_TERMS).sort()).toEqual(['storyboard', 'touchpoint'])
  })

  it('the six entity-kind definitions are the generic set, with no service-specific example', () => {
    // #307/#301: the shared template ships these definitions, so they carry no
    // service-specific example — the exact generic copy agreed during grilling.
    const definitions = Object.fromEntries(
      Object.entries(ENTITY_KIND_DEFINITIONS).map(([kind, term]) => [
        kind,
        term.definition,
      ]),
    )
    expect(definitions).toEqual({
      service:
        'The whole service this blueprint maps, end to end. Everything else on the board is part of it.',
      phase:
        'A chapter of the service, in time order. Each phase holds the scenarios that can happen during it.',
      scenario: 'A specific situation inside a phase, mapped on its own board.',
      path: 'One route through a scenario: the main way, plus variants and exceptions. Paths are alternatives, not stages — nothing carries across them.',
      step: 'A column of the board: one moment in time, read down every lane at once. Steps run left to right.',
      lane: 'A row of the board, for one kind of participant — the customer, frontstage staff, backstage work, the tools. A row reads across every step.',
    })
    // No leftover PLUS example in the copy readers see.
    for (const term of Object.values(ENTITY_KIND_DEFINITIONS)) {
      expect(term.definition).not.toMatch(/PLUS/)
    }
  })
})

/* -------------------------------------- the bare sentence is retired */

describe('the bare-sentence popover shape', () => {
  it('is gone from a made-up word label — the term heads its own definition', async () => {
    render(
      <Field label="Storyboard" hint={PANEL_TERMS.storyboard}>
        <span>frames</span>
      </Field>,
    )
    hover(screen.getByText('Storyboard'))
    const shown = await screen.findByText(PANEL_TERMS.storyboard)
    const card = shown.closest('[data-definition-card]')
    expect(card).not.toBeNull()
    expect(
      within(card as HTMLElement).getAllByText('Storyboard', {
        selector: '[data-definition-eyebrow]',
      }),
    ).toHaveLength(1)
  })

  it('no longer needs the definition to open by naming the term', () => {
    for (const [term, definition] of Object.entries(PANEL_TERMS)) {
      // "Storyboard — the frames for each step" spent its first clause saying
      // what the eyebrow above it already says.
      expect(definition.toLowerCase().startsWith(term.toLowerCase()), term).toBe(
        false,
      )
    }
  })
})

/* ------------------------------------------- nothing announces a definition */

// `process.cwd()`, not `import.meta.url`: Vite rewrites a module's own URL to
// its `/@fs/…` serving path, which is not a path on disk. Same idiom as
// `stakeholderDefinitionReader.test.ts`.
const ROOT = process.cwd()
const SRC = resolve(ROOT, 'src')

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    let directory: boolean
    try {
      directory = statSync(path).isDirectory()
    } catch {
      return []
    }
    if (directory) return sourceFiles(path)
    if (!/\.tsx?$/.test(entry)) return []
    if (/\.test\.tsx?$/.test(entry)) return []
    return [path]
  })
}

/**
 * Class strings only — a comment recording why the cue went is not the cue.
 *
 * A vanished file is skipped rather than thrown on: `harness-claims.test.mjs`
 * writes a probe component under `src` and deletes it again, and vitest runs
 * files in parallel, so a walk of the tree can list a path that is gone by the
 * time it is read. The subject is every file that IS there.
 */
function liveClassMatches(pattern: RegExp): string[] {
  return sourceFiles().flatMap((path) => {
    let source: string
    try {
      source = readFileSync(path, 'utf8')
    } catch {
      return []
    }
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    return pattern.test(code) ? [relative(ROOT, path)] : []
  })
}

describe('nothing on the page announces that a word is defined', () => {
  it('the shared underline cue is deleted, with every use site', () => {
    expect(liveClassMatches(/DEFINED_LABEL_CUE/)).toEqual([])
    // And the underline it drew, in case somebody inlines it back.
    expect(liveClassMatches(/decoration-dotted/)).toEqual([])
  })

  it('no help cursor survives it', () => {
    expect(liveClassMatches(/cursor-help/)).toEqual([])
  })

  it('the canvas title draws no icon beside the name', () => {
    render(<EntityTitleAffordance kind="scenario" id="s-1" label="Warm-Up" />)
    const block = document.querySelector('[data-entity-title]') as HTMLElement
    // The ⓘ existed because a hover-only control is invisible on touch. The
    // opener is the whole block and the definition is a popover, so neither
    // ever needed it (#243).
    expect(block.querySelectorAll('svg')).toHaveLength(0)
  })

  it('and the entity title imports no icon at all', () => {
    const source = readFileSync(
      join(SRC, 'components/blueprint/EntityTitleAffordance.tsx'),
      'utf8',
    )
    expect(source).not.toMatch(/from 'lucide-react'/)
  })

  it('and the grid headers reach for no icon library, touch ⓘ notwithstanding', () => {
    // #306 brought a mark BACK to these headers, but only as the touch reader's
    // door to the definition — invisible on a device that can hover, so the
    // resting board a pointer reader sees is as clean as #243 left it. It is a
    // hand-drawn glyph, deliberately, so the "no icon-library sprawl" rule the
    // headers have held since #243 still stands: the exception is one touch
    // affordance, not a licence to import a sheet of icons.
    for (const file of ['StepHeaderAffordance', 'LaneHeaderAffordance']) {
      const source = readFileSync(
        join(SRC, `components/blueprint/${file}.tsx`),
        'utf8',
      )
      expect(source).not.toMatch(/from 'lucide-react'/)
    }
  })

  it('and the class the glyph wore is gone, not just unused', () => {
    // Left in place it is an invitation: the next header draws an ⓘ because
    // the constant is sitting there already named for the job.
    expect(liveClassMatches(/CANVAS_HEADER_HINT/)).toEqual([])
  })
})

describe('a definition hangs off a badge, never off a label', () => {
  it('the canvas title carries the panel, not a definition', () => {
    // Both the title and the kind badge beside it carried the same
    // definition for one commit, because #240 landed after this branch
    // started. The badge is the one #235 keeps. The title opens the entity
    // PANEL (#305), so it IS interactive now — but no definition popover
    // hangs off it: no `aria-haspopup`, which is what marks a definition
    // trigger elsewhere in this file.
    render(<EntityTitleAffordance kind="scenario" id="s-1" label="Warm-Up" />)
    const title = screen.getByRole('button', { name: 'View details: Warm-Up' })
    expect(title.hasAttribute('aria-haspopup')).toBe(false)
  })

  it('and its source no longer reaches for the definition popover', () => {
    const source = readFileSync(
      join(SRC, 'components/blueprint/EntityTitleAffordance.tsx'),
      'utf8',
    )
    expect(source).not.toMatch(/EntityDefinitionPopover/)
  })
})

/* -------------------------------------------------- the definition popover */

describe('an entity definition', () => {
  it('is one section when there is only a kind to give', async () => {
    render(
      <EntityDefinitionPopover kind="lane">
        <span>Front stage</span>
      </EntityDefinitionPopover>,
    )
    hover(screen.getByText('Front stage'))
    await screen.findByText(ENTITY_KIND_DEFINITIONS.lane.definition)
    const card = document.querySelector('[data-definition-card]') as HTMLElement
    expect(sections(card)).toHaveLength(1)
    expect(eyebrow(sections(card)[0]).textContent).toBe('Lane')
  })

  it('says so when nobody has written the instance description yet', async () => {
    render(
      <EntityDefinitionPopover kind="path" name="Happy Path" description={null} showDescription>
        <span>Happy Path</span>
      </EntityDefinitionPopover>,
    )
    hover(screen.getByText('Happy Path'))
    const card = (
      await screen.findByText(ENTITY_KIND_DEFINITIONS.path.definition)
    ).closest('[data-definition-card]') as HTMLElement
    const [, instance] = sections(card)
    // The placeholder changes the BODY only. The heading is the heading.
    expect(body(instance).className).toContain('italic')
    expect(eyebrow(instance).className).toBe(eyebrow(sections(card)[0]).className)
  })
})

/* --------------------------------------- the deployment's own example (#302) */

/** Design mode, injected the way a test reaches the shared canvas mode. */
function designMode(children: ReactElement) {
  return (
    <CanvasModeContext.Provider
      value={{ mode: 'design', setMode: () => {}, available: true }}
    >
      {children}
    </CanvasModeContext.Provider>
  )
}

describe('the example grounds the generic definition in this deployment', () => {
  it('shows the authored example under the kind, set like every other section', async () => {
    render(
      <EntityExamplesContext.Provider
        value={{ lane: 'The tutor row on the PLUS board' }}
      >
        <EntityDefinitionPopover kind="lane">
          <span>Front stage</span>
        </EntityDefinitionPopover>
      </EntityExamplesContext.Provider>,
    )
    hover(screen.getByText('Front stage'))
    const card = (
      await screen.findByText('The tutor row on the PLUS board')
    ).closest('[data-definition-card]') as HTMLElement
    const [kind, example] = sections(card)
    expect(sections(card)).toHaveLength(2)
    expect(eyebrow(example).textContent).toBe('Example')
    // Identically typeset — the card's one-shape rule holds for this section too.
    expect(eyebrow(example).className).toBe(eyebrow(kind).className)
    expect(body(example).className).toBe(body(kind).className)
  })

  it('is picked by kind — a phase popover shows the phase example, not another', async () => {
    render(
      <EntityExamplesContext.Provider
        value={{ phase: 'Warm-up', lane: 'The tutor row' }}
      >
        <EntityDefinitionPopover kind="phase">
          <span>A phase</span>
        </EntityDefinitionPopover>
      </EntityExamplesContext.Provider>,
    )
    hover(screen.getByText('A phase'))
    await screen.findByText('Warm-up')
    expect(screen.queryByText('The tutor row')).toBeNull()
  })

  it('renders nothing for a reader when the example is blank', async () => {
    render(
      <EntityExamplesContext.Provider value={{}}>
        <EntityDefinitionPopover kind="lane">
          <span>Front stage</span>
        </EntityDefinitionPopover>
      </EntityExamplesContext.Provider>,
    )
    hover(screen.getByText('Front stage'))
    const card = (
      await screen.findByText(ENTITY_KIND_DEFINITIONS.lane.definition)
    ).closest('[data-definition-card]') as HTMLElement
    // Just the kind — no empty Example slot for the reader to puzzle over.
    expect(sections(card)).toHaveLength(1)
    expect(screen.queryByText('Example', { selector: '[data-definition-eyebrow]' })).toBeNull()
  })

  it('shows the unwritten placeholder to an editor when the example is blank', async () => {
    render(
      designMode(
        <EntityDefinitionPopover kind="lane">
          <span>Front stage</span>
        </EntityDefinitionPopover>,
      ),
    )
    hover(screen.getByText('Front stage'))
    const card = (
      await screen.findByText(ENTITY_EXAMPLE_PLACEHOLDER)
    ).closest('[data-definition-card]') as HTMLElement
    const [kind, example] = sections(card)
    expect(eyebrow(example).textContent).toBe('Example')
    // The unwritten treatment: the BODY italicises, the heading does not.
    expect(body(example).className).toContain('italic')
    expect(eyebrow(example).className).toBe(eyebrow(kind).className)
  })
})
