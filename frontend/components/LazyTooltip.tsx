'use client';

import {
  cloneElement,
  useEffect,
  useId,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Tooltip, type TooltipProps } from '@mantine/core';

/** The trigger's own props that this wraps. */
interface TriggerProps {
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  'aria-describedby'?: string | undefined;
}

/** Keyboard focus, not the focus a click gives; the same test Mantine's
 * tooltip makes (floating-ui's `useFocus`, `visibleOnly`). */
function focusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** A tooltip for a trigger repeated down a long list, which costs nothing
 * until the trigger is first hovered or focused (DS-374).
 *
 * A Mantine `Tooltip` sets up floating-ui's positioning and interaction
 * hooks and a portal as soon as it is rendered. Down /lines' ~250 rows (a
 * pin star and a "No data" badge in each) that was about a third of the
 * table's hydration, which a click or keypress in the table before it had
 * hydrated waited for. This renders the trigger alone, as a closed
 * `Tooltip` does (a closed tooltip is not in the DOM and adds no
 * `aria-describedby`), and mounts a `Tooltip` aimed at the trigger
 * (`target`) the first time it is wanted.
 *
 * It opens as the theme's `Tooltip` does: on a mouse hover (not a tap) and
 * on keyboard focus, closing on leave, blur or Escape, and while open it is
 * the trigger's `aria-describedby`. The trigger itself is never re-mounted,
 * so focus stays put. The first opening waits a frame for the tooltip to
 * mount closed, so it fades in like every later one. */
export function LazyTooltip({
  label,
  children,
  ...tooltipProps
}: Omit<TooltipProps, 'children' | 'label' | 'target' | 'opened' | 'defaultOpened' | 'events'> & {
  label: ReactNode;
  children: ReactElement<TriggerProps>;
}) {
  // Whether hover or focus asks for it to be open.
  const [wanted, setWanted] = useState(false);
  // Latched once wanted: the `Tooltip` stays mounted from then on.
  const [mounted, setMounted] = useState(false);
  // Set a frame after mounting, so the first opening is a transition too.
  const [ready, setReady] = useState(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  // A tap's compatibility mouse events come after its `pointerenter`.
  const [pointerType, setPointerType] = useState('');
  const labelId = useId();
  const opened = wanted && ready;
  const triggerProps = children.props;

  useEffect(() => {
    if (!opened) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setWanted(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [opened]);

  function show(element: HTMLElement) {
    setWanted(true);
    if (mounted) return;
    setTrigger(element);
    setMounted(true);
    requestAnimationFrame(() => setReady(true));
  }

  function onPointerEnter(event: PointerEvent<HTMLElement>) {
    setPointerType(event.pointerType);
    triggerProps.onPointerEnter?.(event);
  }

  function onMouseEnter(event: MouseEvent<HTMLElement>) {
    triggerProps.onMouseEnter?.(event);
    // A tap sends mouse events too, and the theme's tooltips don't open
    // on touch.
    if (pointerType !== 'touch') show(event.currentTarget);
  }

  function onMouseLeave(event: MouseEvent<HTMLElement>) {
    triggerProps.onMouseLeave?.(event);
    setWanted(false);
  }

  function onFocus(event: FocusEvent<HTMLElement>) {
    triggerProps.onFocus?.(event);
    if (focusVisible(event.currentTarget)) show(event.currentTarget);
  }

  function onBlur(event: FocusEvent<HTMLElement>) {
    triggerProps.onBlur?.(event);
    setWanted(false);
  }

  return (
    <>
      {cloneElement(children, {
        onPointerEnter,
        onMouseEnter,
        onMouseLeave,
        onFocus,
        onBlur,
        'aria-describedby': opened ? labelId : triggerProps['aria-describedby'],
      })}
      {mounted && (
        <Tooltip
          {...tooltipProps}
          label={<span id={labelId}>{label}</span>}
          target={trigger}
          opened={opened}
          events={{ hover: false, focus: false, touch: false }}
        />
      )}
    </>
  );
}
