'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Stack, Text } from '@mantine/core';

/** A run of walks and transfers folded into one slim row (DS-590): the
 * journey reads as a sequence of trains, and the walk between two of them
 * is one line, "Walk to Victoria, 6 min", that opens to show each leg.
 * Used on the journey page and in the planner's option cards, with the
 * label each builds from its own legs (`lib/legCollapse.ts`).
 *
 * The row is a real button with `aria-expanded` and `aria-controls`,
 * closed by default. The legs stay in the page while closed, hidden, so
 * their `leg-{id}` anchors still exist and a link to one (a `#leg-...`
 * hash) opens the row. Nothing animates, so there is no motion to reduce.
 * Its open state is the component's own, so it survives the page's
 * refreshes. */
export function CollapsedLegs({
  label,
  detail,
  children,
}: {
  /** What the run is and costs: "Walk to Victoria, 6 min". */
  label: string;
  /** Said after the label while closed or open, such as the time to change. */
  detail?: string | null | undefined;
  /** The folded legs. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openForHash = () => {
      const target = window.location.hash.slice(1);
      if (!target || !body.current) return;
      const element = document.getElementById(decodeURIComponent(target));
      if (element && body.current.contains(element)) setOpen(true);
    };
    openForHash();
    window.addEventListener('hashchange', openForHash);
    return () => window.removeEventListener('hashchange', openForHash);
  }, []);

  return (
    <Stack gap={4} data-collapsed-legs data-open={open ? true : undefined}>
      <Box className="collapsedLegs__row">
        <Button
          variant="subtle"
          size="compact-sm"
          className="collapsedLegs__toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          leftSection={
            <svg
              className="collapsedLegs__chevron"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          }
        >
          {label}
        </Button>
        {detail && (
          <Text size="xs" c="dimmed" data-collapsed-legs-detail>
            {detail}
          </Text>
        )}
      </Box>
      <div id={id} ref={body} hidden={!open}>
        <Stack gap="md">{children}</Stack>
      </div>
    </Stack>
  );
}
