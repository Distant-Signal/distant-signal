'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Title, UnstyledButton } from '@mantine/core';
import { SECTION_TITLE_SIZE } from '@/components/SectionTitle';
import classes from './StationFold.module.css';

/** A station page section folded under its own heading, closed by default:
 * the heading is a real button with `aria-expanded` and `aria-controls`, and
 * the section's content is rendered by the server like any other section
 * and stays in the page while closed, hidden, so a search engine reads it
 * and nothing is fetched on open. Like `CollapsedLegs`, nothing animates.
 *
 * It opens by itself for a link to the section or to anything in it: the
 * URL's hash on load and on a hash change, and a click on an in-page link,
 * which fires no hash change when the hash is already the URL's. A closed
 * panel has no box, so the browser's own scroll to the target finds
 * nothing; once open, this scrolls to it. */
export function StationFold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reveal = (hash: string) => {
      let target: HTMLElement | null = null;
      try {
        target = hash === '' ? null : document.getElementById(decodeURIComponent(hash));
      } catch {
        return;
      }
      if (target === null || !root.current?.contains(target)) return;
      const element = target;
      setOpen(true);
      // After the open has rendered, so the target has a box to scroll to.
      window.setTimeout(() => element.scrollIntoView(), 0);
    };
    const fromHash = () => reveal(window.location.hash.slice(1));
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const href = event.target.closest('a')?.getAttribute('href');
      if (href?.startsWith('#')) reveal(href.slice(1));
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', fromHash);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div ref={root} data-station-fold data-open={open ? true : undefined}>
      <Title order={2} size={SECTION_TITLE_SIZE[2]}>
        <UnstyledButton
          className={classes.toggle}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <svg
            className={classes.chevron}
            width="16"
            height="16"
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
          {title}
        </UnstyledButton>
      </Title>
      <div id={id} className={classes.panel} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
