import { PersonalTokens } from './PersonalTokens';
import { getPersonalTokens } from '@/lib/api';

/** `PersonalTokens` with its data, for a server-rendered page (the
 * `/account/connected-apps` route). Renders nothing for a visitor who is
 * not logged in, or while personal API tokens are off. */
export async function PersonalTokensSection({ headingOrder = 2 }: { headingOrder?: 2 | 3 }) {
  const data = await getPersonalTokens();
  if (!data) return null;
  return <PersonalTokens data={data} headingOrder={headingOrder} />;
}
