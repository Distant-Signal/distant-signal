'use client';

import { ConfirmActionButton } from './ConfirmActionButton';
import { REGULAR_JOURNEYS_HREF } from '@/lib/regularJourneys';

/** Deletes a journey template the caller owns
 * (`DELETE /JourneyTemplates/{id}`). Every journey this template ever
 * produced (`journeys.source_template_id`) survives untouched — see
 * `crates/api/src/data/journey_templates.rs::delete_template`'s own doc
 * comment (`ON DELETE SET NULL`, not a cascade) — so the confirm copy
 * below says so explicitly, unlike `RemoveJourneyLegButton`'s "this
 * cannot be undone" alone, since a caller might otherwise reasonably fear
 * losing journeys they've already run from this template. Always
 * redirects to `/journeys/templates` on success (mirrors
 * `RemoveJourneyLegButton`'s `afterDelete`-style "closest surviving list"
 * target for a delete that removes the CURRENT page's own object) rather
 * than a bare `router.refresh()`, since this component is used both on
 * the list (Task 7) and the detail page (Task 8) and the detail page
 * itself is gone after a successful delete. */
export function DeleteJourneyTemplateButton({ templateId }: { templateId: number }) {
  return (
    <ConfirmActionButton
      label="Delete regular journey"
      actionName="delete regular journey"
      title="Delete this regular journey?"
      request={() => fetch(`/api/JourneyTemplates/${templateId}`, { method: 'DELETE' })}
      failure={['delete', 'this regular journey']}
      loginPrompt="Log in to delete this regular journey"
      onSuccess={(router) => router.push(REGULAR_JOURNEYS_HREF)}
    >
      Journeys already made from it are kept.
    </ConfirmActionButton>
  );
}
