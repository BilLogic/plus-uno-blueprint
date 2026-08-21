import { EntityTitleAffordance } from '@/components/blueprint/EntityTitleAffordance'
import {
  BLUEPRINT_MENUBAR_DESCRIPTION_CLASS,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import { useServiceSpec } from '@/hooks/useServiceSpec'

/**
 * The overview's title bar — the service, and the way into its properties.
 *
 * The overview deliberately had no bar: "a bar holding only a repeated title
 * read as a broken fragment", and plan 003 declined to build the sidebar's
 * Service row for the same reason — it "has no second job waiting on it".
 *
 * Opening the service panel is that second job. The row now names the thing
 * you are looking at AND is the only way to reach what the service says about
 * itself, which is what the phase and scenario headers already do one level
 * down. Same component, same shape, one level up.
 *
 * Renders nothing until the service resolves. There is no skeleton here on
 * purpose: this is a single line above a canvas that is drawing its own
 * placeholder, and a bar that flickers in over it would be the loudest thing
 * on a still-loading screen.
 */
export function ServiceOverviewHeader() {
  const result = useServiceSpec(null)
  const service = result.status === 'ready' ? result.data : null
  if (!service) return null

  return (
    <div className={BLUEPRINT_MENUBAR_TITLE_CLASS}>
      <EntityTitleAffordance
        kind="service"
        id={service.id}
        label={service.name}
      />
      {service.summary ? (
        <p
          className={BLUEPRINT_MENUBAR_DESCRIPTION_CLASS}
          title={service.summary}
        >
          {service.summary}
        </p>
      ) : null}
    </div>
  )
}
