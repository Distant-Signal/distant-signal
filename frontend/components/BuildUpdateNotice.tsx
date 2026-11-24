'use client';

import { Button, Notification } from '@mantine/core';
import { useMounted } from '@mantine/hooks';
import { clientBuildEpoch, isBuildStale } from '@/lib/buildEpoch';
import { useObservedMinBuild } from '@/lib/minBuildStore';
import { reloadForUpdate } from '@/lib/reloadForUpdate';

/** Offers a reload when this page's build is below the operator's floor
 * (`FRONTEND_MIN_BUILD`, docs/frontend-min-build.md), so an installed shell
 * left open for days retires itself. The floor reaches it two ways with no
 * extra request: `serverMinBuild`, which RootLayout re-reads on every
 * navigation and refresh, and the `X-DS-Min-Build` header on any `/api/*`
 * response (`lib/buildHeader.ts`). Hidden until mount, hidden when either side
 * is unknown (a build with no epoch, no floor set). It never reloads by
 * itself, never moves focus and never covers the page: a reload could lose
 * form input, and the page cannot tell that it would not. */
export function BuildUpdateNotice({ serverMinBuild }: { serverMinBuild: number | null }) {
  const mounted = useMounted();
  const observed = useObservedMinBuild();
  const min = Math.max(serverMinBuild ?? 0, observed ?? 0) || null;
  if (!mounted || !isBuildStale(clientBuildEpoch(), min)) return null;
  return (
    <div className="updateBanner">
      <Notification withCloseButton={false} title="Update available" role="status" aria-live="polite">
        A new version of Distant Signal is available.
        <Button
          size="compact-sm"
          mt="xs"
          display="block"
          onClick={() => {
            void reloadForUpdate();
          }}
        >
          Reload
        </Button>
      </Notification>
    </div>
  );
}
