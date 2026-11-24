'use client';

import { useEffect, useRef, useState } from 'react';
import { VisuallyHidden } from '@mantine/core';

export const OWNERSHIP_TRANSFERRED_EVENT = 'ds:group-ownership-transferred';

/** The group page's live region for an ownership transfer, and where focus
 * goes afterwards. It sits on the page, not inside the "Make owner"
 * control, because the page refresh that follows a transfer removes that
 * control (the viewer is no longer the owner). `viewerRole` is the viewer's role
 * from the refreshed page: once it is no longer `owner`, the refresh has
 * landed, and focus moves to the page's h1 so a keyboard or screen reader
 * user is not left on a removed button. */
export function GroupOwnershipAnnouncer({ viewerRole }: { viewerRole: string }) {
  const [message, setMessage] = useState('');
  const pendingFocus = useRef(false);

  useEffect(() => {
    function onTransferred(event: Event) {
      pendingFocus.current = true;
      setMessage(event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : '');
    }
    window.addEventListener(OWNERSHIP_TRANSFERRED_EVENT, onTransferred);
    return () => window.removeEventListener(OWNERSHIP_TRANSFERRED_EVENT, onTransferred);
  }, []);

  useEffect(() => {
    if (viewerRole === 'owner' || !pendingFocus.current) return;
    pendingFocus.current = false;
    const heading = document.querySelector('h1');
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [viewerRole]);

  return (
    <VisuallyHidden role="status" aria-live="polite">
      {message}
    </VisuallyHidden>
  );
}
