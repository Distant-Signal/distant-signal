'use client';

import { useId, type ComponentPropsWithoutRef, type MouseEvent } from 'react';
import { Button, VisuallyHidden, type ButtonProps } from '@mantine/core';
import { ButtonSpinner } from './LoadingText';

type GatedButtonProps = Omit<ButtonProps, 'disabled'> &
  Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonProps | 'disabled'> & {
    /** Why the action can't be taken yet, in a sentence that says what is
     * missing ("Enter a group name."). While set the button is blocked and
     * the sentence is its accessible description. */
    blockedReason?: string | null;
    /** A request this button started is in flight. */
    busy?: boolean;
  };

/**
 * A primary action that waits for input (or for its own request) without
 * dropping out of the Tab order.
 *
 * A bare `disabled` button is skipped by Tab, drops keyboard focus to the
 * page when it becomes disabled under it, and gives a screen reader user no
 * reason (DS-626, F6). This keeps the button focusable with `aria-disabled`,
 * looks the same as a disabled one (`data-disabled` is Mantine's disabled
 * look), ignores the press, and points `aria-describedby` at a visually
 * hidden sentence saying what is missing.
 */
export function GatedButton({
  blockedReason = null,
  busy = false,
  onClick,
  leftSection,
  children,
  'aria-describedby': describedBy,
  ...rest
}: GatedButtonProps) {
  const reasonId = useId();
  const blocked = blockedReason !== null && blockedReason !== '';
  const inert = blocked || busy;
  const describedByIds = [describedBy, blocked ? reasonId : undefined].filter(Boolean).join(' ');
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inert) {
      // A blocked submit button must not submit the form it is in.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }
  return (
    <>
      <Button
        {...rest}
        onClick={handleClick}
        leftSection={busy ? <ButtonSpinner /> : leftSection}
        {...(inert && { 'aria-disabled': true, 'data-disabled': true })}
        {...(busy && { 'aria-busy': true })}
        {...(describedByIds !== '' && { 'aria-describedby': describedByIds })}
      >
        {children}
      </Button>
      {blocked && <VisuallyHidden id={reasonId}>{blockedReason}</VisuallyHidden>}
    </>
  );
}
