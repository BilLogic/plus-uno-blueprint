import { PanelKindBadge } from '@/components/blueprint/panelShell'

/**
 * The owner badge — which member of the cast owns this row, and, on hover,
 * what the registry says that party IS.
 *
 * The definition is read from `stakeholders.summary` and is never copied onto
 * the thing that displays it. That is the whole reason the badge takes a
 * stakeholder rather than a string: a stakeholder is service-level and owns
 * many rows — `Regular Tutor` owns 37 lanes — so a copy per row would be 37
 * chances to disagree with the one place the definition is authored.
 *
 * The definition hangs off the badge itself rather than an ⓘ beside it, for
 * the reason `PanelKindBadge` was built: the badge IS the name whose meaning
 * is in question, and hovering the word you do not recognise is where you
 * would look for it. `docs/reference/panel-affordances.md` states that as the
 * rule and its standing prohibition — nothing carries two mechanisms for one
 * fact — is why no caller of this component also prints the same sentence.
 *
 * A stakeholder with no definition gets a plain badge and no hover, because a
 * tooltip that opens empty teaches a reader that hovering is not worth it.
 */
export function StakeholderBadge({
  name,
  summary,
}: {
  name: string
  /** The registry's own one-liner, or null while nobody has written one. */
  summary: string | null
}) {
  return <PanelKindBadge label={name} title={name} description={summary} />
}
