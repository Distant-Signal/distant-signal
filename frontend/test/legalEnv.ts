import { vi } from 'vitest';

/** Example operator details for tests: the legal config is read from the
 * environment (`lib/legal.ts`), and the source carries no real operator. */
export const TEST_LEGAL_ENV = {
  LEGAL_OPERATOR_NAME: 'Example Operator',
  LEGAL_CONTACT_EMAIL: 'legal@example.com',
  LEGAL_SSO_LOG_RETENTION: '30 days',
  LEGAL_LAST_UPDATED: '1 November 2026',
} as const;

/** Stubs every required `LEGAL_*` value, plus `overrides` (a value of
 * `undefined` blanks that name). Pair with `vi.unstubAllEnvs()` in
 * `afterEach`. */
export function stubLegalEnv(overrides: Record<string, string | undefined> = {}): void {
  const merged: Record<string, string | undefined> = { ...TEST_LEGAL_ENV, ...overrides };
  for (const [name, value] of Object.entries(merged)) {
    vi.stubEnv(name, value ?? '');
  }
}
