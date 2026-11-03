'use client';

import type { ReactNode } from 'react';
import { Accordion, AccordionControl, AccordionItem, AccordionPanel } from '@mantine/core';

/** Flush, chrome-free disclosure, as `StationAccessibilitySection.tsx`'s. */
const DISCLOSURE_STYLES = {
  item: { border: 'none', backgroundColor: 'transparent' },
  control: { padding: 0, paddingBlock: 'var(--mantine-spacing-xs)' },
  chevron: { marginInlineEnd: 'var(--mantine-spacing-xs)' },
  panel: { paddingInlineStart: 0 },
  content: { paddingInline: 0 },
} as const;

/** A long field table, collapsed by default (`/developers/api`). An
 * `Accordion` with `keepMounted={false}`, as the station page's
 * disclosures: a real `aria-expanded` button, and the hidden table is
 * unmounted. Every route's control reads "Response fields (12)", so
 * `qualifier` (the route) goes into the accessible name to keep the
 * panels' region names unique. */
export function ApiFieldsDisclosure({
  label,
  qualifier,
  children,
}: {
  label: string;
  qualifier: string;
  children: ReactNode;
}) {
  return (
    <Accordion chevronPosition="left" keepMounted={false} styles={DISCLOSURE_STYLES}>
      <AccordionItem value="fields">
        <AccordionControl aria-label={`${qualifier}: ${label}`}>{label}</AccordionControl>
        <AccordionPanel>{children}</AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}
