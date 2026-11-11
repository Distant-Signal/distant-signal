'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { deleteKey, getPendingDeletes, subscribePendingDeletes, type DeleteKind } from '@/lib/pendingDeletes';

const EMPTY = getPendingDeletes();

/** Renders nothing while the journey or train is waiting out its undo
 * window, or once it is deleted, so a row disappears the moment the delete
 * is confirmed and comes back on Undo or if the delete fails. The page
 * itself is a Server Component and still lists the row until it refreshes. */
export function HideWhenDeleted({ kind, id, children }: { kind: DeleteKind; id: number; children: ReactNode }) {
  const { hidden } = useSyncExternalStore(subscribePendingDeletes, getPendingDeletes, () => EMPTY);
  return hidden.has(deleteKey(kind, id)) ? null : children;
}
