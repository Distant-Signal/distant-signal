/**
 * Deletes that wait a few seconds so they can be undone.
 *
 * Confirming a delete of a journey or a tracked train hides the row at once
 * and schedules the real `DELETE` for `DELETE_UNDO_WINDOW_MS` later. Undo
 * cancels it. A deadline, a page being hidden or closed (`flushPendingDeletes`,
 * which uses a `keepalive` fetch so the browser finishes it after the page
 * is gone) sends it, so a delete is never silently lost. Nothing is kept on
 * the server while it waits.
 *
 * Module state, not component state, so a pending delete survives the
 * in-app navigation that follows deleting from a detail page (the toast
 * host lives in the root layout). `useSyncExternalStore` readers get
 * immutable snapshots.
 */

import { describeFailure, failureFromResponse } from './failure';

/** How long Undo is offered. */
export const DELETE_UNDO_WINDOW_MS = 10_000;

export type DeleteKind = 'journey' | 'train';

export interface PendingDelete {
  key: string;
  kind: DeleteKind;
  id: number;
  /** "Journey deleted", "Stopped tracking this train". */
  message: string;
}

export interface DeleteFailure {
  key: string;
  message: string;
}

export interface PendingDeleteSnapshot {
  pending: readonly PendingDelete[];
  /** Keys whose row stays hidden: pending, or deleted for good. */
  hidden: ReadonlySet<string>;
  failures: readonly DeleteFailure[];
}

interface Entry extends PendingDelete {
  url: string;
  failure: readonly [verb: string, noun: string];
  onDeleted: (() => void) | undefined;
  onRestored: (() => void) | undefined;
  timer: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

export interface ScheduleDeleteInput {
  kind: DeleteKind;
  id: number;
  message: string;
  /** The same-origin `/api/...` URL to `DELETE`. */
  url: string;
  /** `describeFailure`'s verb and noun: `['delete', 'the journey']`. */
  failure: readonly [verb: string, noun: string];
  /** After the server accepted the delete. */
  onDeleted?: () => void;
  /** After Undo, or after a failed delete put the row back. */
  onRestored?: () => void;
}

export const deleteKey = (kind: DeleteKind, id: number): string => `${kind}:${String(id)}`;

const entries = new Map<string, Entry>();
const deleted = new Set<string>();
let failures: DeleteFailure[] = [];
const listeners = new Set<() => void>();
let snapshot: PendingDeleteSnapshot = { pending: [], hidden: new Set(), failures: [] };

function publish() {
  snapshot = {
    pending: [...entries.values()].map(({ key, kind, id, message }) => ({ key, kind, id, message })),
    hidden: new Set([...entries.keys(), ...deleted]),
    failures,
  };
  for (const listener of listeners) listener();
}

export function subscribePendingDeletes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getPendingDeletes = (): PendingDeleteSnapshot => snapshot;

function clearTimer(entry: Entry) {
  if (entry.timer !== null) clearTimeout(entry.timer);
  entry.timer = null;
}

function startTimer(entry: Entry) {
  clearTimer(entry);
  entry.startedAt = Date.now();
  entry.timer = setTimeout(() => {
    void send(entry.key, false);
  }, entry.remaining);
}

/** Hides the row and sends the `DELETE` after the undo window. A second
 * delete of something already pending or deleted is ignored. */
export function scheduleDelete(input: ScheduleDeleteInput): void {
  const key = deleteKey(input.kind, input.id);
  if (entries.has(key) || deleted.has(key)) return;
  const entry: Entry = {
    key,
    kind: input.kind,
    id: input.id,
    message: input.message,
    url: input.url,
    failure: input.failure,
    onDeleted: input.onDeleted,
    onRestored: input.onRestored,
    timer: null,
    remaining: DELETE_UNDO_WINDOW_MS,
    startedAt: 0,
  };
  entries.set(key, entry);
  failures = failures.filter((f) => f.key !== key);
  if (!paused) startTimer(entry);
  publish();
}

/** Cancels a pending delete and shows the row again. */
export function undoDelete(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  clearTimer(entry);
  entries.delete(key);
  publish();
  entry.onRestored?.();
}

let paused = false;

/** Holds every timer while the visitor hovers or focuses the toast, so
 * keyboard and pointer users are never raced. */
export function pauseDeletes(): void {
  if (paused) return;
  paused = true;
  const now = Date.now();
  for (const entry of entries.values()) {
    if (entry.timer === null) continue;
    entry.remaining = Math.max(0, entry.remaining - (now - entry.startedAt));
    clearTimer(entry);
  }
}

export function resumeDeletes(): void {
  if (!paused) return;
  paused = false;
  for (const entry of entries.values()) startTimer(entry);
}

export function dismissFailure(key: string): void {
  failures = failures.filter((f) => f.key !== key);
  publish();
}

/** Sends one delete. `keepalive` lets the request outlive the page. A 404
 * counts as done: the row is already gone, whoever removed it. */
async function send(key: string, keepalive: boolean): Promise<void> {
  const entry = entries.get(key);
  if (!entry) return;
  clearTimer(entry);
  entries.delete(key);
  deleted.add(key);
  publish();
  let message: string | null = null;
  try {
    const response = await fetch(entry.url, { method: 'DELETE', keepalive });
    if (!response.ok && response.status !== 404) {
      message = await failureFromResponse(entry.failure[0], entry.failure[1], response);
    }
  } catch {
    message = describeFailure(entry.failure[0], entry.failure[1]);
  }
  if (message === null) {
    entry.onDeleted?.();
    return;
  }
  deleted.delete(key);
  failures = [...failures.filter((f) => f.key !== key), { key, message }];
  publish();
  entry.onRestored?.();
}

/** Sends every pending delete now, for a page that is being hidden or
 * closed. Uses `keepalive` so the browser finishes the requests. */
export function flushPendingDeletes(): void {
  for (const key of [...entries.keys()]) void send(key, true);
}

/** Test reset. */
export function resetPendingDeletes(): void {
  for (const entry of entries.values()) clearTimer(entry);
  entries.clear();
  deleted.clear();
  failures = [];
  paused = false;
  publish();
}
