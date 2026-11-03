/** Personal API tokens (docs/personal-api-tokens.md): the words the
 * Connected apps page uses for them. */

export type PersonalTokenScope = 'journeys:read' | 'lines:read' | 'trains:read' | 'preferences:read';

/** Every scope, in the order the page lists them. */
export const PERSONAL_TOKEN_SCOPES: readonly PersonalTokenScope[] = [
  'journeys:read',
  'lines:read',
  'trains:read',
  'preferences:read',
];

/** What each scope lets a token read. */
const SCOPE_SENTENCES: Record<PersonalTokenScope, string> = {
  'journeys:read': 'See your saved journeys',
  'lines:read': 'See line status and station disruption',
  'trains:read': 'See trains and live departures',
  'preferences:read': 'See your pinned lines, stations and notification settings',
};

export function isPersonalTokenScope(scope: string): scope is PersonalTokenScope {
  return (PERSONAL_TOKEN_SCOPES as readonly string[]).includes(scope);
}

/** The sentence for a scope; an unknown one is shown as its name. */
export function personalScopeSentence(scope: string): string {
  return isPersonalTokenScope(scope) ? SCOPE_SENTENCES[scope] : scope;
}

/** "7 days", "1 year": how a lifetime choice reads. */
export function lifetimeLabel(days: number): string {
  if (days === 365) return '1 year';
  return days === 1 ? '1 day' : `${days} days`;
}
