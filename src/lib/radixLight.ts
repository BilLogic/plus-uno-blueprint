/**
 * Frozen mirror of the light half of `src/styles/colors.css`, as hex.
 *
 * The blueprint canvas is the app's second colour system: it must render and
 * print identically regardless of theme, so its values are inlined via `style`
 * rather than read from a CSS custom property that `.dark` would re-point. That
 * rules out `var(--color-blue-500)` at the use site — but it does not have to
 * mean inventing colours. Every entry below is the light-theme value of a step
 * that already ships in colors.css, so the canvas and the app chrome draw from
 * one palette even though only one of them is theme-aware.
 *
 * Step semantics are Radix's: 500 is a component surface, 900 the solid fill,
 * 1000 its hovered weight, 1100 low-contrast text, 1200 high-contrast text.
 *
 * Keep in sync with colors.css. Only steps actually used by the canvas are
 * listed; add a step here when the canvas needs it, not speculatively.
 */
export const RADIX_LIGHT = {
  // Step 300 — the palest tint. Annotation shape fills, which have to sit over
  // a step-500 cell without swallowing it.
  amber300: '#FFF4D5',
  blue300: '#EDF6FF',
  green300: '#E9F9EE',
  indigo300: '#F0F4FF',
  lime300: '#EEF6D6',
  orange300: '#FFF1E7',
  pink300: '#FEEEF8',
  red300: '#FFEFEF',
  slate300: '#F1F3F5',
  violet300: '#F5F2FF',

  // Step 500 — cell surfaces and sticky notes.
  amber500: '#FFE3A2',
  indigo500: '#D9E2FC',
  red500: '#FDD8D8',
  yellow500: '#FEF2A4',
  blue500: '#CEE7FE',
  green500: '#CCEBD7',
  lime500: '#D3E7A6',
  orange500: '#FFDCC3',
  pink500: '#F9D8EC',
  slate500: '#E6E8EB',
  violet500: '#E4DEFC',

  // Step 900 — solid fills (annotation ink).
  amber900: '#FFB224',
  blue900: '#0091FF',
  green900: '#30A46C',
  red900: '#E5484D',
  orange900: '#F76808',
  slate900: '#889096',
  violet900: '#6E56CF',

  // Step 1000 — the hovered weight of step 900. Used for path arrows: one notch
  // lighter than the badge so a stroke reads as related to, not the same as,
  // the label it belongs to.
  blue1000: '#0081F1',
  crimson1000: '#E03177',
  green1000: '#299764',
  indigo1000: '#3A5CCC',
  orange1000: '#ED5F00',
  pink1000: '#D23197',
  purple1000: '#8445BC',
  red1000: '#DC3D43',
  violet1000: '#644FC1',

  // Step 1100 — low-contrast text. Every value here clears 4.5:1 against white,
  // which is what path badges need since they render `text-white` on this fill.
  blue1100: '#006ADC',
  crimson1100: '#D31E66',
  gold1100: '#776750',
  green1100: '#18794E',
  indigo1100: '#3451B2',
  orange1100: '#BD4B00',
  pink1100: '#CD1D8D',
  purple1100: '#793AAF',
  red1100: '#CD2B31',
  tomato1100: '#CA3214',
  violet1100: '#5746AF',
  yellow1100: '#946800',

  // Step 1200 — high-contrast text.
  slate1200: '#11181C',
} as const
