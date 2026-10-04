import { packageCoverFigures } from 'uno-blueprint'
import type { CoverContent } from 'uno-blueprint'

/**
 * PLUS Uno Blueprint's cover-page content — every user-facing string on the
 * landing view.
 *
 * The renderers in `components/cover/` are shared with the Uno Blueprint
 * template and know nothing about PLUS; a deployment is entirely defined by
 * this module. This deployment's own service comes first, then the four
 * general tabs, which describe the blueprint model, slices and the skills and
 * follow the template's wording. Where they differ, the difference is local:
 * "Where you reach it from" names four surfaces, the Slack bot among them,
 * where the template ships three; a few phrasings predate the template's
 * latest edits (among them title-case use names and the skill-set
 * opener); and the two "Inside one" figures carry
 * their own alt text, below.
 *
 * THE THIRTEEN DIAGRAMS COME FROM THE PACKAGE, and are values rather than
 * paths. Who authored a figure is who supplies it: those thirteen draw the
 * blueprint MODEL — a numbered user, frontstage and backstage, what a slice
 * selects out of a path — and are the same drawing whichever service is
 * blueprinted, so `packageCoverFigures` brings them and this deployment gets
 * them by depending on the package. It used to keep its own copies under
 * `public/cover/`, which was two bad things at once: nobody here had authored
 * any of them, so the copies could only drift, and a copy that went missing
 * did not 404 — the single-page fallback answered `200 text/html` and a
 * reader got a broken-image box while the network tab said success. A figure
 * is an import now; a missing one stops the build.
 *
 * The two portraits on the service tab ARE this deployment's own artwork — its
 * logomark and its tutor illustration — so they stay in `public/` and stay
 * named as paths. That is the split, and it is about authorship rather than
 * file type.
 *
 * A figure's fields are overridable one at a time, which is what the two
 * spreads below are for: the drawings say "Inside one path" and "Inside one
 * cell" in their own titles, and this page's alt text says it the same way.
 * Everything else — the dimensions, which are each SVG's viewBox, so the page
 * reserves the right box before the image decodes — is taken whole.
 */
export const coverContent: CoverContent = {
  title: 'PLUS Uno Blueprint',
  lede: 'A structured repository of the service experiences PLUS supports for tutors. It holds every phase, scenario, path, and action in one system, from Application through Post-session, including Program Administration. Unlike a static diagram, the blueprint is structured data: agents can query it, teams can cut focused views from it, and a proposed change can be traced through the service before anyone acts on it.',
  primaryCtaLabel: 'View PLUS Blueprints',
  commandCopy: { copyLabel: 'Copy', copiedLabel: 'Copied' },
  states: {
    noSlices: 'No slices in this workspace yet — `/ub:slice` cuts the first one.',
  },
  tabs: [
    {
      value: 'the-service',
      label: 'The service',
      // The services tab: its body is one page per service (#303/#338). When the
      // deployment holds more than one, the tab shows the selector and reads
      // "Services", and the selected service's page renders; with PLUS's single
      // service it stays "The service" with no selector, rendering the one page
      // below — byte-for-byte what it was before (#336).
      services: {
        pluralLabel: 'Services',
        pages: [
          {
            // PLUS's own page. Keyed to its route slug (`PLUS Tutoring` ->
            // `plus-tutoring`, the production row's slug); the single-service
            // render falls back to this sole page regardless, so the page shows
            // even before the slug resolves.
            slug: 'plus-tutoring',
            sections: [
              {
                kind: 'portrait',
                id: 'service-plus',
                heading: 'PLUS Tutoring',
                paragraphs: [
                  'PLUS Tutoring is a hybrid human-AI tutoring platform with 500+ tutors, used across 13+ schools, supporting 5,000+ middle school students through real-time, in-class math tutoring sessions.',
                ],
                image: {
                  src: '/homepage/plus-icon.png',
                  alt: 'The PLUS logomark, a plus sign in a gradient tile',
                  size: 'badge',
                },
              },
              {
                kind: 'portrait',
                id: 'service-tutors',
                heading: 'Tutors',
                paragraphs: [
                  'Tutors at PLUS are university students working part time. Before they run sessions, they complete onboarding and lesson modules. In each tutoring session they typically support about 5–6 students, guided by the PLUS app built by the PLUS team. The blueprints in here follow that arc, Application through Post-session, so a tutor journey and the staff work behind it are read from one map.',
                ],
                image: {
                  src: '/homepage/tutor-illustration.png',
                  alt: 'Illustration of a PLUS tutor',
                  size: 'framed',
                },
              },
            ],
          },
        ],
      },
    },
    {
      value: 'overview',
      label: 'Overview',
      sections: [
        {
          kind: 'prose',
          id: 'overview-why',
          heading: 'Why a blueprint that stays true',
          paragraphs: [
            'Service blueprints have always been worth having and have always gone stale. They were strategic artifacts (commissioned, workshopped, opened at a quarterly, twice-yearly or yearly review) because reading one took facilitation and context you had to rebuild every time. The map decayed quietly, and nothing in the week depended on it enough to force a correction.',
            'This project makes one bet: put the blueprint in a structure an agent can query, and the cost of reading it collapses. Interpretation stops being the expensive part, so the map gets consulted in ordinary work rather than at reviews. Because something now depends on it daily, keeping it accurate has a practical reason rather than a virtuous one.',
          ],
          figure: packageCoverFigures.whyNow,
        },
        {
          kind: 'defs',
          id: 'overview-when',
          heading: 'How teams use it',
          intro:
            'Teams can use the blueprint in different ways and adopt each use case as it becomes relevant.',
          columns: { term: 'Use', definition: 'What the blueprint gives you' },
          items: [
            {
              term: 'Onboarding',
              definition:
                'Give someone new a complete view of the service before they take ownership of one part of it.',
            },
            {
              term: 'Stakeholder Alignment',
              definition:
                'Each audience is given the one view that concerns them, cut from the same source, so no two rooms are reading different pictures.',
            },
            {
              term: 'Decision Evaluation',
              definition:
                'A proposed change is traced through the dependency graph first, so what it would break is visible before anyone commits to it.',
            },
            {
              term: 'Context Management',
              definition:
                'The audit names what is missing, in conflict, or unowned, so the map can be corrected rather than left to drift.',
            },
          ],
          figure: packageCoverFigures.whenToUse,
        },
        {
          kind: 'prose',
          id: 'overview-where',
          heading: 'Where you reach it from',
          paragraphs: [
            'The same blueprint can be accessed in four ways. The app is where people read, compare, and present. The in-app agent drafts changes in place, using the same write path the interface uses. Agentic tools reach the same rows from an IDE or a terminal, where the skills run. The Slack bot answers questions and links back to the exact cell it read.',
            'All four sit on one shared context layer, so what any surface reads is what the others wrote. Who may do what follows from the account a surface signs in with, not from which surface it is.',
          ],
          figure: packageCoverFigures.fourWaysIn,
        },
      ],
      link: {
        label: 'Learn more →',
        docPath: 'docs/guide/02-using-it-in-practice.md',
      },
    },
    {
      value: 'blueprints',
      label: 'Blueprints',
      sections: [
        {
          kind: 'prose',
          id: 'blueprints-organized',
          heading: 'How a blueprint is organized',
          paragraphs: [
            'A **service** is organized into **phases**, and phases can loop back to earlier ones to model repeat visits or renewals without duplicating the journey. Each phase contains **scenarios** that represent the different situations an actor might be in, and each scenario contains **paths** that show the different ways that situation can unfold, including the expected path and variations where something changes or goes wrong.',
          ],
          figure: packageCoverFigures.dataModelHierarchy,
        },
        {
          kind: 'prose',
          id: 'blueprints-path',
          heading: 'Inside one path',
          paragraphs: [
            'Each path is a grid. Lanes are rows, with one actor per lane, and steps are columns, moving from left to right over time. A **cell** is where a lane and step meet, showing what that actor does at that moment. Arrows show **dependencies** between cells.',
            'The **line of interaction**, **line of visibility**, and **line of internal interaction** are derived from the roles of the lanes, so they cannot drift out of agreement with the actors they separate. Steps are defined at the scenario level, and each path uses the relevant steps in its own order, making different paths easier to compare precisely.',
          ],
          figure: {
            ...packageCoverFigures.blueprintAnatomy,
            alt: 'Inside one path — lanes as rows, steps as columns, a cell where they cross, leads-to arrows from cell to cell, and the derived divider lines between the lanes',
          },
        },
        {
          kind: 'prose',
          id: 'blueprints-cell',
          heading: 'Inside one cell',
          paragraphs: [
            "A cell captures one actor's action at one step, along with the context around it. It shows where the action sits in the blueprint, what happens, what form it takes, and the value it creates. It also records both who **owns** the action and who the customer believes owns it, since those are not always the same.",
            'Each cell can also include supporting **evidence**, linked resources, and **dependencies**: what leads to the action, what it leads to, what enables it, and what it enables. It also shows which slices reference that cell, so you can see which views would be affected if it changed.',
          ],
          figure: {
            ...packageCoverFigures.cellAnatomy,
            alt: 'Inside one cell — one cell on the board opened into its record: placement, ownership, function, evidence, resources, dependencies, and the slices that cite it',
          },
        },
      ],
      link: {
        label: 'Learn more →',
        docPath: 'docs/guide/01-the-blueprint-model.md',
      },
    },
    {
      value: 'slices',
      label: 'Slices',
      sections: [
        {
          kind: 'prose',
          id: 'slices-intro',
          heading: 'A view taken out of the blueprint',
          paragraphs: [
            'A blueprint is complete by design, but that can make it too much for one audience or question. A **slice** is a focused view built from an ordered set of cells, with its own title and caption.',
            'Slices reference the original cells instead of copying them. That means they stay connected to the source, so when the blueprint changes, the slice does not become an outdated snapshot.',
            'A slice opens in its own tab beside the blueprint, making it easy to move between the focused view and the full service. In presentation mode, it can also be viewed slide by slide. Both the slice and individual presentation slides can be linked directly, so you can share exactly what you are looking at.',
          ],
          figure: packageCoverFigures.sliceConcept,
        },
        {
          kind: 'defs',
          id: 'slices-types',
          heading: 'Five ways to slice',
          columns: { term: 'Type', definition: 'What it selects' },
          items: [
            {
              term: 'journey',
              definition: 'One actor, and the cells in other lanes that theirs connect to.',
            },
            {
              term: 'step',
              definition: 'One moment, across every lane at that step.',
            },
            { term: 'lane', definition: 'One lane, across every step of the path.' },
            { term: 'cell', definition: 'One cell in full.' },
            {
              term: 'custom',
              definition: 'A view built around a question the other four types do not already name.',
            },
          ],
          figure: packageCoverFigures.slicingModel,
        },
      ],
      link: {
        label: 'Learn more →',
        docPath: 'docs/guide/01-the-blueprint-model.md',
      },
    },
    {
      value: 'skills',
      label: 'Skills',
      sections: [
        {
          kind: 'prose',
          id: 'skills-set',
          heading: 'The skill set',
          paragraphs: [
            'Four Claude Code skills maintain the blueprint, rather than anyone keeping it up by hand. Each skill has its own playbooks and scripts and links the shared references its task needs, and each ends at a deterministic gate, such as a validator exit, a sign-off, or a read-back that matches.',
            'More intensive analysis runs in fresh-context agents that return a summary rather than carrying all of the source material forward. This helps catch issues the original drafting context may be too anchored on.',
          ],
          figure: packageCoverFigures.skillArchitecture,
        },
        {
          kind: 'skill',
          id: 'skills-map',
          command: '/ub:map',
          summary:
            'Builds a blueprint from what you already have (such as existing documents, a working session, or another service diagram). It produces a validated blueprint file, and each scenario is reviewed and signed off before that file is imported into the workspace.',
          figure: packageCoverFigures.ubMap,
        },
        {
          kind: 'skill',
          id: 'skills-audit',
          command: '/ub:audit',
          summary:
            'Checks the blueprint for anything missing, conflicting, or unowned. It produces findings for review, but does not make changes to the blueprint itself.',
          figure: packageCoverFigures.ubAudit,
        },
        {
          kind: 'skill',
          id: 'skills-whatif',
          command: '/ub:whatif',
          summary:
            'Traces a proposed change through the dependency graph before it is made. It shows which cells would be affected and which assumptions might break, working from a copy rather than the live blueprint.',
          figure: packageCoverFigures.ubWhatif,
        },
        {
          kind: 'skill',
          id: 'skills-slice',
          command: '/ub:slice',
          summary:
            'Creates a focused view of the blueprint for a specific stakeholder or question. Each slice continues to reference the original cells it came from.',
          figure: packageCoverFigures.ubSlice,
        },
        {
          kind: 'prose',
          id: 'skills-outro',
          paragraphs: [
            'These skills run where you write code, not on this page. Install the repository as a plugin and ask for what you need.',
          ],
        },
      ],
      link: { label: 'Learn more →', docPath: 'docs/guide/03-the-plugin.md' },
    },
  ],
}
