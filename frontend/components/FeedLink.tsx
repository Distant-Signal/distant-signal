import { TextLink } from './TextLink';

/** A small link to a page's Atom feed (`lib/feeds.ts`), for feed readers.
 * `prefetch={false}`: the href is an api route, not a page, so there is
 * nothing for Next to prefetch. `label` names what the feed follows, for
 * screen readers; it contains the visible "Feed". */
export function FeedLink({ href, label }: { href: string; label: string }) {
  return (
    <TextLink href={href} prefetch={false} size="sm" underline="always" ariaLabel={`Feed: ${label}`}>
      Feed
    </TextLink>
  );
}
