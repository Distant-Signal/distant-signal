import { Card, Group, Stack } from '@mantine/core';
import {
  PageSkeleton,
  SkeletonCardGrid,
  SkeletonPill,
  SkeletonRows,
  SkeletonSection,
  SkeletonText,
} from '@/components/PageSkeleton';
import { tokens } from '@/lib/theme';

/** The home page's skeleton, the Suspense fallback for a visitor with a
 * session cookie while the page fetches statuses, the visitor's pins and
 * their journeys. It is not a `loading.tsx`: a route boundary would flush
 * before the page knew the visitor was anonymous and hide the h1 and summary
 * a crawler needs from the first bytes. A visitor with no cookie never sees it.
 *
 * The session isn't known yet, so this draws the logged-in layout, the one
 * people come back to: the "Current journey" card (`CurrentJourneyCard`'s
 * padding, name, preview line and two facts, inside the same
 * `.currentJourneyCard` border), an "Upcoming journeys" list, then the
 * "Your lines" grid and a list section. A visitor without a journey under
 * way, or logged out, sees those sections give way to the next. */
export function HomeSkeleton() {
  return (
    <PageSkeleton label="Loading the home page" gap="xl">
      <SkeletonSection>
        <Card {...tokens.card.static} padding="lg" className="currentJourneyCard">
          <Stack gap="sm">
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <SkeletonText width="45%" />
                <SkeletonPill width={88} />
              </Group>
              <SkeletonText size="sm" width="40%" />
            </Stack>
            <SkeletonText lines={2} size="sm" width="70%" />
          </Stack>
        </Card>
      </SkeletonSection>
      <SkeletonSection>
        <SkeletonRows count={2} />
      </SkeletonSection>
      <SkeletonSection>
        <SkeletonCardGrid count={3} />
      </SkeletonSection>
      <SkeletonSection>
        <SkeletonRows count={2} />
      </SkeletonSection>
    </PageSkeleton>
  );
}
