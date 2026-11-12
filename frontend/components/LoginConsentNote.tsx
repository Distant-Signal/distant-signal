'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Text, type MantineSpacing } from '@mantine/core';
import { TextLink } from './TextLink';

/** LEG-1: whether the legal pages are published, decided per request on
 * the server (`legalPagesPublished()` in app/layout.tsx) and handed to the
 * client-side login controls. Defaults to false, so without a provider the
 * note never renders. */
const LoginConsentContext = createContext<{ published: boolean; minimumAge: string }>({
  published: false,
  minimumAge: '18',
});

/** `minimumAge` is `LEGAL_CONFIG.MINIMUM_AGE`, read on the server: the
 * legal config comes from the server's runtime environment, which a client
 * component cannot see. */
export function LoginConsentProvider({
  published,
  minimumAge = '18',
  children,
}: {
  published: boolean;
  minimumAge?: string;
  children: ReactNode;
}) {
  return <LoginConsentContext.Provider value={{ published, minimumAge }}>{children}</LoginConsentContext.Provider>;
}

/** LEG-1: "by logging in you agree" next to the login actions -- shown only
 * once the Terms and Privacy notice it links to are actually published,
 * never while they 404. */
export function LoginConsentNote({ mt }: { mt?: MantineSpacing }) {
  const { published, minimumAge } = useContext(LoginConsentContext);
  if (!published) return null;
  return (
    <Text size="xs" c="dimmed" {...(mt !== undefined && { mt })} data-login-consent>
      By logging in you agree to our{' '}
      <TextLink href="/terms" size="xs" underline="always" inline>
        terms of use
      </TextLink>{' '}
      and confirm you have read our{' '}
      <TextLink href="/privacy" size="xs" underline="always" inline>
        privacy notice
      </TextLink>
      . You must be {minimumAge} or over.
    </Text>
  );
}
