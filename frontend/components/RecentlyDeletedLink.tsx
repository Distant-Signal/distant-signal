import { TextLink } from './TextLink';
import { getSessionOrLoggedOut } from '@/lib/api';
import { RECENTLY_DELETED_HREF } from '@/lib/recentlyDeleted';

/** The Journeys page header's "Recently deleted" link, for a logged-in
 * visitor while the api keeps deleted journeys (`recentlyDeletedEnabled`
 * in the session read). Nothing otherwise, so the page is as before while
 * the feature is off. Its own session read, so the page needs no change
 * beyond rendering it. */
export async function RecentlyDeletedLink() {
  const session = await getSessionOrLoggedOut();
  if (!session.authenticated || !session.recentlyDeletedEnabled) return null;
  return <TextLink href={RECENTLY_DELETED_HREF}>Recently deleted</TextLink>;
}
