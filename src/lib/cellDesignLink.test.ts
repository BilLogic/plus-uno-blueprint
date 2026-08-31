import { describe, expect, it } from 'vitest'

import {
  designLinkLabel,
  resolveDesignUrl,
} from '@/lib/cellDesignLink'
import {
  TECH_DESCRIPTION_LINK_TYPE,
  URL_LINK_TYPE,
} from '@/lib/blueprintTechDescriptions'
import type { CellLink } from '@/types/blueprint'

const figmaOnCell: CellLink[] = [
  {
    type: URL_LINK_TYPE,
    label: 'Figma',
    url: 'https://www.figma.com/file/cell-wide',
  },
]

describe('resolveDesignUrl', () => {
  it('prefers the placement’s own link over the cell’s', () => {
    expect(
      resolveDesignUrl('https://www.figma.com/file/this-moment', figmaOnCell),
    ).toBe('https://www.figma.com/file/this-moment')
  })

  it('prefers it even when it is not Figma', () => {
    // The defect this is here for. The first version only preferred the
    // placement's url when the host was figma.com, so a Pencil file or a
    // Notion page attached to ONE moment lost to a cell-wide Figma link —
    // a placement field overruled by a cell field, which inverts the whole
    // precedence a placement exists for.
    expect(resolveDesignUrl('https://pencil.dev/doc/42', figmaOnCell)).toBe(
      'https://pencil.dev/doc/42',
    )
  })

  it('falls back to a Figma link on the cell when the placement has none', () => {
    expect(resolveDesignUrl(null, figmaOnCell)).toBe(
      'https://www.figma.com/file/cell-wide',
    )
  })

  it('recognises a cell link labelled Figma whatever it points at', () => {
    expect(
      resolveDesignUrl(null, [
        { type: URL_LINK_TYPE, label: 'Figma prototype', url: 'https://p.dev/x' },
      ]),
    ).toBe('https://p.dev/x')
  })

  it('does not promote an unrelated cell resource to “the design”', () => {
    // A cell's resources are a mixed bag — a ticket, a doc, a recording — and
    // putting the first of them behind a screenshot links somewhere that has
    // nothing to do with the picture.
    expect(
      resolveDesignUrl(null, [
        { type: URL_LINK_TYPE, label: 'Ticket', url: 'https://tracker.dev/1' },
      ]),
    ).toBeNull()
  })

  it('ignores links of other kinds in the same array', () => {
    // `cells.links` holds resources, tech descriptions and pictures together;
    // reading past the `type` is how the old resolver found the wrong thing.
    expect(
      resolveDesignUrl(null, [
        {
          type: TECH_DESCRIPTION_LINK_TYPE,
          label: 'PLUS App',
          url: 'https://www.figma.com/file/detail',
        },
      ]),
    ).toBeNull()
  })

  it('treats whitespace as no link at all', () => {
    expect(resolveDesignUrl('   ', figmaOnCell)).toBe(
      'https://www.figma.com/file/cell-wide',
    )
  })
})

describe('designLinkLabel', () => {
  it('promises Figma only where the click lands on Figma', () => {
    expect(designLinkLabel('https://www.figma.com/file/x')).toBe('View in Figma')
    expect(designLinkLabel('https://pencil.dev/doc/42')).toBe('Open the design')
    expect(designLinkLabel(null)).toBe('Open the design')
  })
})
