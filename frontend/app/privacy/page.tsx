import { List, ListItem, Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { ContactEmail, LegalPage, LegalSection, requireLegalPages } from '@/components/LegalPage';
import { TextLink } from '@/components/TextLink';
import {
  ACCOUNT_DELETE_LABEL,
  ACCOUNT_EXPORT_LABEL,
  ACCOUNT_ROUTE,
  describeRetentionDays,
  LEGAL_CONFIG,
  legalPageMetadata,
  retentionPolicy,
  type RetentionPolicy,
} from '@/lib/legal';
import { withAbsoluteTitle } from '@/lib/pageMetadata';

// ============================================================================
// DRAFT -- NOT LEGAL ADVICE -- REVIEW BEFORE PUBLISHING.
// Drafted from the 2026-09-27 UK legal compliance gap analysis (LEG-1, LEG-3,
// LEG-4, LEG-5, LEG-7, LEG-8, LEG-11, LEG-28 and "Lawful basis by data
// category"). The operator, and ideally a lawyer, must check every statement
// against how the service actually runs before setting LEGAL_PAGES_PUBLISHED.
// Retention periods below follow the api's actual retention settings, which
// the chart passes to the frontend (lib/legal.ts `retentionPolicy`): tracked
// trains, tickets and journeys after the travel date, push subscriptions
// after a long absence, and -- only once enabled (DQ7: 730 days, after this
// notice is published) -- whole inactive accounts. Journeys made from a
// regular journey go sooner only while `REGULAR_JOURNEY_RETENTION_DAYS` is
// on (DS-379; ds-api's data/retention.rs `prune_regular_occurrences`): keep
// the sentence's list of what keeps one in step with that query.
// Server logs: Loki keeps the distant-signal namespace's logs for 31 days
// (Ranma-Config's per-namespace retention rule); the SFTP audit tiers keep
// 90 and 400 days. See docs/personal-data-retention.md.
// Usage analytics (DS-190): the api's feature counters (Prometheus, 30 days,
// no identifiers, legitimate interests) and the opt-in usage counts
// (`usage_daily`, daily totals, 13 months, consent; GPC and DNT honoured).
// Keep both rows in step with crates/api/src/usage_events.rs and
// docs/personal-data-retention.md (both in Distant-Signal/ds-api).
// Login service and Discord account ID (DS-301): public login moves to a
// login service of its own (ds-sso, Ranma-Config
// docs/specs/ds-public-auth-idp.md), and the api keeps `users.discord_id`
// so an account survives the change of `sub` (ds-api docs/connected-apps.md,
// "Account continuity"). The "Logging in" section is worded for after that
// cut-over; this text has to be in place before the Discord ids are loaded.
// ============================================================================

// Reads the legal-pages flags per request (see lib/legal.ts).
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return withAbsoluteTitle(
    legalPageMetadata(
      'Privacy notice',
      'What personal data Distant Signal holds, why, for how long, and your rights.',
      '/privacy',
    ),
  );
}

interface DataCategory {
  title: string;
  what: string;
  why: string;
  basis: string;
  retention: string;
}

const CONTRACT = 'Contract (UK GDPR Art. 6(1)(b)): we need it to provide the service you asked for.';
const LEGITIMATE_INTERESTS = 'Legitimate interests (UK GDPR Art. 6(1)(f)): keeping the service secure and working.';
const IMPROVING =
  'Legitimate interests (UK GDPR Art. 6(1)(f)): understanding how the service is used, in a way that cannot identify you.';

/** One entry per row of the audit's "Lawful basis by data category" table.
 * Built per request from the live retention settings. */
function dataCategories(retention: RetentionPolicy): readonly DataCategory[] {
  const travel =
    retention.pastTravelDays > 0
      ? `, or ${describeRetentionDays(retention.pastTravelDays)} after the travel date, whichever comes first`
      : '';
  const deleted =
    retention.recentlyDeletedDays > 0
      ? ` When you delete a tracked train or journey, it stops being tracked and its history, tickets, share links and group shares are deleted straight away. What it was (its name, and each leg's date, stations or places, train and planned times) is kept in Recently deleted for ${describeRetentionDays(retention.recentlyDeletedDays)} so you can save it again, then deleted for good. A journey a connected app deleted is kept there for 30 days. For a few seconds after you delete one, Undo is offered. Journeys that are deleted automatically after their travel date do not go to Recently deleted, and deleting your account deletes everything in it straight away.`
      : '';
  const regular =
    retention.regularJourneyDays > 0
      ? ` Journeys made from a regular journey go sooner: ${describeRetentionDays(retention.regularJourneyDays)} after the travel date, unless you might claim Delay Repay for one (you added ticket details to one of its trains, one was cancelled or arrived 15 or more minutes late, or you missed a connection). Those, and journeys made from a regular journey you have since deleted, are kept like other journeys.`
      : '';
  return [
    {
      title: 'Your account',
      what: 'The ID our login service gives you, your display name and username, the access groups needed to decide which features you can use, and when you signed up and last logged in. If you log in with Discord, also your Discord account ID: the number Discord gives your account, not your Discord username.',
      why: 'To create and run your account. We use your Discord account ID only to recognise your account if our login service gives you a new ID, so you keep your journeys and settings.',
      basis: CONTRACT,
      retention:
        retention.inactiveAccountDays > 0
          ? `Until you delete your account. If you do not log in for ${describeRetentionDays(retention.inactiveAccountDays)} (and have no active session), we delete your account and everything in it automatically. We do not hold your email address, so we cannot warn you first.`
          : 'Until you delete your account.',
    },
    {
      title: 'Login sessions',
      what: 'A hashed session token and its expiry, and short-lived login state (a one-time code verifier and security values).',
      why: 'To keep you logged in, and to protect logging in from forgery.',
      basis: `${CONTRACT} ${LEGITIMATE_INTERESTS}`,
      retention:
        'Sessions expire after 14 days without use, or 90 days after you log in, and are then deleted. Login state is deleted after 15 minutes.',
    },
    {
      title: 'Personal API tokens',
      what: 'For each token you create: its name, what it can read, a scrambled form of the token, its last 4 characters, and when it was created, last used, expires or was revoked.',
      why: 'To let things you run yourself read your data, and to let you see and revoke them.',
      basis: CONTRACT,
      retention:
        'Until you revoke it, it expires (at most a year), or it goes 90 days without use. The record of an ended token is deleted a year later.',
    },
    {
      title: 'Saved lines, stations, operators and custom lines',
      what: 'The lines, stations and operators you pin, and any custom lines you create.',
      why: 'To show you the things you chose to follow.',
      basis: CONTRACT,
      retention: 'Until you remove them or delete your account.',
    },
    {
      title: 'Tracked trains, journeys and regular journeys',
      what: 'The date, origin, destination and operator of trains and journeys you track, any names you give them, how late each of your trains arrived and whether it was cancelled, the minutes you say you need to get to the station, a history of the changes to each journey and the alternative trains we suggested when one stopped working, whose bank holidays your regular journeys skip (England and Wales, Scotland or Northern Ireland), the date a paused regular journey starts again, and any time away you add (its dates and a name if you give one).',
      why: 'To track your trains and journeys and tell you about delays.',
      basis: CONTRACT,
      retention: `Tracked trains and journeys: until you delete them or delete your account${travel}.${deleted}${regular} Regular journeys: until you delete them or delete your account. Time away: until the day after it ends, or until you delete it or your account.`,
    },
    {
      title: 'Tickets',
      what: "Ticket details you add to a journey's train: the ticket type, whether it is only valid on one train company, and a name if you give one. No price, file or barcode. An Apple Wallet pass you upload to fill these in is read in memory and never stored.",
      why: 'To estimate Delay Repay more closely (a single or a return, and which company to claim from).',
      basis: CONTRACT,
      retention: `Until you remove them, or delete the journey or your account${travel}. Wallet passes are not kept at all.`,
    },
    {
      title: 'Groups',
      what: 'Groups you create or join, your role in them, and the trains, journeys and custom lines you share. Other members see your display name and what you share. We do not hold your email address, so no one can see it here.',
      why: 'To let you share travel plans with people you invite.',
      basis: CONTRACT,
      retention: 'For as long as you are a member, or until the group or your account is deleted.',
    },
    {
      title: 'Share and invite links',
      what: 'Links you create to share a journey or invite people to a group. Anyone who has a share link can view what it shares.',
      why: 'To let you share with people who do not have an account.',
      basis: CONTRACT,
      retention: 'Deleted 30 days after you revoke them or they expire.',
    },
    {
      title: 'Calendar feed link (only if you turn it on)',
      what: 'If you turn on the calendar feed: a scrambled form of the secret link your calendar app uses, and when it was made or turned off. Anyone who has the link can see your calendar: for each journey in the last week and the days ahead, its two stations and when it leaves, and, after a journey that may have been late or had a cancelled train, a reminder to check Delay Repay that says so. The credits for our data go in every entry. Never the train, the ticket, or a name you gave a journey.',
      why: 'To show your journeys, and Delay Repay reminders, in your calendar app.',
      basis: CONTRACT,
      retention:
        'Until you turn it off or make a new link (the old one stops working straight away), or delete your account. The record of a link you turned off is deleted 30 days later.',
    },
    {
      title: 'Push notifications',
      what: 'If you turn on notifications: the address your browser gives us for sending them, its encryption keys, a short label for the device worked out from your browser (such as "Chrome on Android"; we do not keep the full identification string your browser sends), and when it was last used.',
      why: 'To send you the notifications you asked for.',
      basis: CONTRACT,
      retention: `Until you turn notifications off, your browser's push service tells us the address no longer works, you have more than 20 devices registered (the oldest is removed)${
        retention.stalePushSubscriptionDays > 0
          ? `, you have not logged in (and your browser has not renewed the address) for ${describeRetentionDays(retention.stalePushSubscriptionDays)}`
          : ''
      }, or you delete your account.`,
    },
    {
      title: 'Addresses for your notifications (only if you add one)',
      what: 'For each address you add: its name, the web address you gave us, any token you gave us or secret key we made for you (kept encrypted), the type (your own address, ntfy or Gotify), whether it is on, when we last reached it, and a short reason if the last try failed. We send it the text of a notification you would get anyway, which can include your route, times and delays, when it was sent, and a link to the page it opens. That link, and the tag in messages to your own address, contain the numbers we use for your journey, leg or train. An address of your own also gets a link to our credits page. We never send your account ID, name or email.',
      why: 'To send your notifications to a service or device you run or choose, as well as to your browser.',
      basis: CONTRACT,
      retention:
        'Until you delete the address or your account. We turn an address off if it keeps failing, and keep it until you delete it. You can have up to 5.',
    },
    {
      title: 'Your location',
      what: 'If you use "near me", your browser sends your approximate location (rounded to about 100 metres) so we can find the nearest stations.',
      why: 'To find stations near you.',
      basis: CONTRACT,
      retention: 'Not stored. It can appear briefly in our server logs (see below).',
    },
    {
      title: 'Technical logs and IP addresses',
      what: 'Your IP address, the pages you request and when, handled by our network provider (Cloudflare), our servers and our login service.',
      why: 'To keep the service secure, prevent abuse, limit how many requests one address can make, and fix faults.',
      basis: LEGITIMATE_INTERESTS,
      retention: `Our server logs are kept for up to 31 days. Our login service keeps its event logs for ${LEGAL_CONFIG.SSO_LOG_RETENTION}. Cloudflare keeps its logs under its own policy.`,
    },
    {
      title: 'Feature counts',
      what: 'Our servers count how often features are used and how they turn out, such as how many trains are tracked, trips planned or share links opened. These are running totals with no account, IP address or other identifier attached, and they never name a station, line, train or journey.',
      why: 'To see which features are used and whether they work, so we can fix and improve them.',
      basis: `${IMPROVING} To object, email us (see "Your right to object").`,
      retention: 'Kept in our monitoring system for 30 days.',
    },
    {
      title: 'Usage counts (only if you turn them on)',
      what: 'If you turn on "Help improve Distant Signal", your browser tells us which kinds of page you open (such as "a line page", never which line), which steps of a feature you reach and which of its options you use (such as searching for a trip and getting results, which kind of timetable you look up, or opening a list of earlier stops), when a search finds nothing, when a request or page fails (with only its error reference), whether you use the installed app, and when the offline page was shown. Never a specific station, line, train or journey. It uses no cookies, and goes only to us. We add each one to a daily total, split only by whether you were logged in, and store nothing that identifies you: no IP address, account, device or browser details.',
      why: 'To learn which features are used and where people run into problems, so we can improve them.',
      basis:
        'Consent (UK GDPR Art. 6(1)(a)): it is off unless you turn it on, in Preferences or on the cookies page. You can withdraw this consent at any time with the same switch. If your browser sends Global Privacy Control or Do Not Track, nothing is sent even if it is on.',
      retention:
        'Daily totals are kept for 13 months, then deleted. Turning it off (withdrawing your consent) stops any more counts straight away. Totals already counted cannot be linked to you or anyone else.',
    },
    {
      title: 'Connections to our file-transfer server',
      what: 'Our timetable supplier sends us files over a file-transfer (SFTP) server open to the internet. For every connection to it we log the IP address, the time, any username tried and what was transferred.',
      why: 'To secure that server against break-in attempts, and to show which files we received from our supplier and when.',
      basis: LEGITIMATE_INTERESTS,
      retention:
        "31 days for connections that never try to log in, 90 days for failed logins and blocked addresses, and 400 days for successful logins and file transfers (in practice, only our supplier's).",
    },
    {
      title: 'Backups',
      what: 'Encrypted daily copies of our database, which include the data above.',
      why: 'To recover from failures.',
      basis: 'The same basis as the data they contain.',
      retention:
        retention.recentlyDeletedDays > 0
          ? `Up to 14 days. Data you delete can stay in our backups for up to 14 days after it is deleted for good. A journey in Recently deleted is deleted for good when its ${describeRetentionDays(retention.recentlyDeletedDays)} end, so it can be in a backup for up to ${describeRetentionDays(retention.recentlyDeletedDays + 14)} after you delete it.`
          : 'Up to 14 days. Data you delete can stay in our backups for up to 14 days.',
    },
  ];
}

export default function PrivacyPage() {
  const mode = requireLegalPages();
  const { OPERATOR_NAME, ICO_REGISTRATION, MINIMUM_AGE } = LEGAL_CONFIG;
  const categories = dataCategories(retentionPolicy());
  return (
    <LegalPage draft={mode === 'preview'} title="Privacy notice">
      <LegalSection title="Who we are">
        <Text>
          Distant Signal is run by {OPERATOR_NAME}, the controller of your personal data. Contact us about privacy at{' '}
          <ContactEmail />.
        </Text>
        {ICO_REGISTRATION ? <Text>ICO registration: {ICO_REGISTRATION}.</Text> : null}
      </LegalSection>

      <LegalSection title="In brief">
        <List size="sm" spacing={2}>
          <ListItem>You can look at live rail information without an account.</ListItem>
          <ListItem>
            If you log in, we keep your account, the journeys and settings you add, and technical logs, to run Distant
            Signal. We do not sell your data or use it for advertising.
          </ListItem>
          <ListItem>You can download or delete your data yourself, and you can complain to us or to the ICO.</ListItem>
          <ListItem>The details are below.</ListItem>
        </List>
      </LegalSection>

      <LegalSection title="What we collect, why, and for how long">
        <Text>
          You can look at live rail information without an account. We only hold personal data about you if you log in,
          or in the technical logs every website produces. If you turn on usage counts, we keep only anonymous daily
          totals.
        </Text>
        {categories.map((category) => (
          <Stack key={category.title} gap={4}>
            <Title order={3} size="h5">
              {category.title}
            </Title>
            <List size="sm" spacing={2}>
              <ListItem>What: {category.what}</ListItem>
              <ListItem>Why: {category.why}</ListItem>
              <ListItem>Lawful basis: {category.basis}</ListItem>
              <ListItem>How long: {category.retention}</ListItem>
            </List>
          </Stack>
        ))}
      </LegalSection>

      <LegalSection title="Logging in">
        <Text>
          You log in through our own login service, which is used only for Distant Signal and runs on infrastructure we
          operate ourselves. When you log in with Discord, Discord tells our login service your Discord account ID,
          username and display name. Our login service keeps these, so it can recognise you the next time you log in,
          and passes them to Distant Signal with an ID for your account. It also keeps the event logs described above.
        </Text>
        <Text>
          When we moved logging in to this service, we copied the Discord account ID of each existing account from the
          login service we used before. That lets your first login through the new service open your existing account,
          with everything in it, rather than a new empty one.
        </Text>
      </LegalSection>

      <LegalSection title="The AI chat">
        <Text>
          The chat is optional. If you use it, you give it your own Anthropic API key, which is stored only in your
          browser and never sent to us. Your messages, and any Distant Signal data the chat looks up to answer them, go
          directly from your browser to Anthropic under your own Anthropic account and{' '}
          <TextLink href="https://www.anthropic.com/legal" external underline="always" inline tone="inherit">
            Anthropic&apos;s terms
          </TextLink>
          . We do not receive or keep your chat. The answers are generated by AI and may be inaccurate.
        </Text>
      </LegalSection>

      {/* Delegated access (docs/superpowers/specs/2026-10-14-ds-mcp-delegated-
          access-design.md). Live. */}
      <LegalSection title="Connecting your AI assistant">
        <Text>
          This is optional and off unless you turn it on. You turn it on in Connected apps on your account page. It lets
          an AI assistant you have connected to Distant Signal, such as Claude, work with the journeys in your account.
        </Text>
        <List size="sm" spacing={4}>
          <ListItem>It can save journeys you plan with it, and list and read your own journeys.</ListItem>
          <ListItem>
            It can delete only journeys it saved itself that are not shared with a group or by a link.
          </ListItem>
          <ListItem>
            It can read journeys shared in a group only if a group owner or admin has turned this on for that group.
            Other members&apos; journey names are hidden from it.
          </ListItem>
          <ListItem>It cannot create share links or change your groups.</ListItem>
        </List>
        <Text>
          The journeys it saves, lists or reads (their names, dates, stations and trains) go through our assistant
          connector, which we run ourselves, to your assistant&apos;s AI provider, such as Anthropic. The provider
          handles them under your own account and its own terms.
        </Text>
        <Text>
          To disconnect, use Disconnect in Connected apps. It takes effect straight away. The connection also ends after
          90 days without use, and when you log out of our login service. Logging out of Distant Signal alone does not
          end it.
        </Text>
        <Text>
          We log each request your assistant makes (your account, the time, what it asked for and whether it worked),
          never the journey contents, and keep these logs for 31 days. We keep a list of the journeys it deleted (name,
          date, stations and train) for 30 days, shown in Connected apps so you can save them again. After a connection
          ends we keep a record of it (which app, what it could do, and when it was connected, last used and ended) for
          one year, then delete it.
        </Text>
      </LegalSection>

      {/* Journey calendar feed (ds-api docs/calendar-feed.md). Live in
          production since 2026-11-10 (api.calendarFeed.enabled), so it is
          worded as a live opt-in feature. */}
      <LegalSection title="Your journey calendar">
        <Text>
          This is optional and off unless you turn it on. You can turn on a calendar feed in Preferences. It gives you a
          private link to add to your calendar app, such as Google Calendar or Apple Calendar, so your journeys appear
          there.
        </Text>
        <List size="sm" spacing={4}>
          <ListItem>
            It shows the journeys in your account, not ones shared with you: for each, its two stations and when it
            leaves.
          </ListItem>
          <ListItem>
            After a journey that may have been late enough to claim Delay Repay, or had a cancelled train, it adds a
            reminder to check Delay Repay. The entry says the journey may have been late or had a cancelled train, so
            anyone with the link can tell. It falls on about the last day we think your train company takes claims
            (usually 28 days after the journey), with an alert a week before. We use the company that ran your last
            train, and a standard 15-minute, 28-day rule when we don&apos;t know it. These are estimates. Check the
            company&apos;s own page, which is the one that counts. We never make a claim for you.
          </ListItem>
          <ListItem>It never shows the train, the ticket or any name you gave a journey.</ListItem>
        </List>
        <Text>
          Anyone who has the link can see these journeys, which show where you travel, so keep it private. We store only
          a scrambled form of it, so we can&apos;t show it to you again. Turn it off, or make a new link, in
          Preferences. That takes effect straight away.
        </Text>
        <Text>
          Your calendar app&apos;s provider fetches the link and keeps a copy of your journeys under its own terms. That
          provider isn&apos;t run by us, and turning the feed off does not delete what it has already kept. Calendar
          apps refresh slowly, so it shows your plans, not live train times.
        </Text>
      </LegalSection>

      {/* Personal API tokens (docs/specs/personal-api-tokens.md §9). Live
          (api.personalTokens.enabled). */}
      <LegalSection title="Personal API tokens">
        <Text>
          This is optional. You can create a personal API token in Connected apps on your account page, to let something
          you run yourself, such as a home dashboard or a phone shortcut, read your Distant Signal data. A token can
          only read. It can&apos;t change or delete anything. You choose what it can read (your journeys, line status,
          trains, or your settings) and when it expires, up to a year.
        </Text>
        <Text>
          Anyone who has the token can read what it allows, so keep it private. We store only a scrambled form of it, so
          we can&apos;t show it to you again. If it&apos;s lost or leaked, revoke it in Connected apps. That takes
          effect straight away. A token also stops working after 90 days without use. Logging out does not end it.
        </Text>
        <Text>
          Where the token&apos;s data goes after that depends on what you put it in. That app or device isn&apos;t run
          by us.
        </Text>
        <Text>
          We log each request made with a token (your account, which token, the time, what it asked for and whether it
          worked) and keep these logs for 31 days. After a token is revoked or expires, we keep a record of it (its
          name, what it could read, and when it was created, last used and ended) for one year, then delete it.
        </Text>
      </LegalSection>

      {/* Outbound webhooks (DS-415). */}
      <LegalSection title="Sending notifications elsewhere">
        <Text>
          This is optional and off unless you add an address. You can add a web address in Notifications on your account
          page, and we send it the same notifications you get in your browser, under the same settings (quiet hours,
          pauses and the trains you turned off). You choose where they go: another app or device, such as ntfy or Gotify
          (independent services, not run by us), or an address of your own. Those services, and any address you choose,
          are run by other people, not by us. They see what we send and handle it under their own terms.
        </Text>
        <List size="sm" spacing={4}>
          <ListItem>
            We send the notification&apos;s title and text, which can include your route, times and delays, when it was
            sent, whether it is urgent, and a link to the page it opens. That link contains the number we use for your
            journey or train, and so does the tag in messages to your own address (ntfy and Gotify get the link, not the
            tag). We never send your account ID, your name or your email.
          </ListItem>
          <ListItem>
            We do not send the notices about your account, such as a new connected app or personal API token.
          </ListItem>
          <ListItem>
            For an address of your own we sign each message with a secret key we make for you and show once. Keep it
            private. For ntfy and Gotify you give us an access token or app token, which we store encrypted so we can
            send notifications. We never show a token again.
          </ListItem>
          <ListItem>
            We only send to public web addresses over https. We refuse private, local and internal addresses, and we do
            not follow redirects.
          </ListItem>
          <ListItem>
            If an address keeps failing we turn it off and tell you why in Notifications. Delete it there at any time,
            and it takes effect straight away.
          </ListItem>
        </List>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <List size="sm" spacing={4}>
          <ListItem>
            Cloudflare, our network provider, which handles every visit to the site (including your IP address) on our
            behalf.
          </ListItem>
          <ListItem>
            Discord, if you log in with Discord. Discord is a separate controller and its own privacy policy applies.
          </ListItem>
          <ListItem>
            The push service your browser uses (Google, Mozilla or Apple), if you turn on notifications. It carries each
            notification to your device. We have no contract with it. It cannot read the content, which is encrypted for
            your browser only; it does see when notifications are sent and how big they are.
          </ListItem>
          <ListItem>
            Any address you add for your notifications, such as ntfy or Gotify (their own servers, or one you run), only
            if you add one (see above).
          </ListItem>
          <ListItem>Anthropic, only if you use the AI chat with your own key (see above).</ListItem>
          <ListItem>Your AI assistant&apos;s provider, only if you connect your assistant (see above).</ListItem>
          <ListItem>Members of groups you join, and anyone you give a share link to (see above).</ListItem>
        </List>
        <Text>
          Our login service, database and backups all run on infrastructure we operate ourselves. We do not sell your
          data or use it for advertising.
        </Text>
      </LegalSection>

      <LegalSection title="International transfers">
        <Text>
          Our own servers are in the European Union, currently in Vienna, Austria, and our backups are stored in the
          European Union too. So your personal data is transferred to, and stored on, servers in the EU. The UK
          recognises the European Economic Area, which includes Austria, as providing adequate protection for personal
          data (UK adequacy regulations), so we need no further safeguards for that.
        </Text>
        <Text>
          Cloudflare handles every visit, including your IP address, in whichever of its data centres is nearest to you,
          which can be outside the UK and the EU, including in the United States. It does so for us under a data
          processing agreement that includes the UK International Data Transfer Addendum.
        </Text>
        <Text>
          If you log in with Discord, turn on notifications, add a notification address, use the AI chat or connect an
          assistant, those providers (Discord, your browser&apos;s push service, the address you choose, Anthropic or
          your assistant&apos;s provider) process data in the United States, and possibly elsewhere. They do so under
          their own terms with you, not under a contract with us. We send to them only because you chose the feature.
        </Text>
      </LegalSection>

      <LegalSection title="Your rights">
        <Text>
          You have the right to access, correct, delete, restrict or object to our use of your personal data, to receive
          it in a portable format, and to withdraw any consent you gave us (see &quot;Your right to object&quot; and
          &quot;Complaints&quot; below).
        </Text>
        <List size="sm" spacing={4}>
          <ListItem>
            To get a copy of your data, use <strong>{ACCOUNT_EXPORT_LABEL}</strong> on your{' '}
            <TextLink href={ACCOUNT_ROUTE} underline="always" inline>
              account page
            </TextLink>
            .
          </ListItem>
          <ListItem>
            To delete your account and its data, use <strong>{ACCOUNT_DELETE_LABEL}</strong> on the same page. Deleting
            your Distant Signal account does not delete your Discord account or your account on our login service. You
            can remove Distant Signal&apos;s access in Discord&apos;s settings. To have your login service account
            deleted, email <ContactEmail />.
          </ListItem>
          <ListItem>
            For anything else, or if you cannot log in, email <ContactEmail />. We reply within one month. For a complex
            request, or several at once, the law lets us take up to two more months. If we need that, we tell you within
            the first month and explain why.
          </ListItem>
        </List>
      </LegalSection>

      <LegalSection title="Your right to object">
        <Text>
          Where we rely on legitimate interests (for example technical logs, feature counts and our file-transfer
          server&apos;s logs), you can object at any time by emailing <ContactEmail />. We will stop unless we have
          compelling grounds to continue, which we would explain to you.
        </Text>
      </LegalSection>

      <LegalSection title="Complaints">
        <Text>
          You have the right to complain to us about how we use your personal data. Email <ContactEmail /> and tell us
          what went wrong. We acknowledge every complaint within 30 days and tell you the outcome without undue delay.
        </Text>
        <Text>
          You can also complain to the Information Commissioner&apos;s Office (ICO) at{' '}
          <TextLink href="https://ico.org.uk/make-a-complaint/" external underline="always" inline tone="inherit">
            ico.org.uk
          </TextLink>{' '}
          or on 0303 123 1113, whether or not you have complained to us first.
        </Text>
      </LegalSection>

      <LegalSection title="Automated decisions">
        <Text>
          We do not make decisions about you by automated means that have legal or similarly significant effects.
        </Text>
      </LegalSection>

      <LegalSection title="Children">
        <Text>Distant Signal is not intended for anyone under {MINIMUM_AGE}.</Text>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <Text>
          We only use cookies and browser storage that the service needs or that you choose to turn on. See the{' '}
          <TextLink href="/cookies" underline="always" inline>
            cookies page
          </TextLink>
          .
        </Text>
      </LegalSection>

      <LegalSection title="Changes to this notice">
        <Text>If we change this notice, we will update the date at the top of this page.</Text>
      </LegalSection>
    </LegalPage>
  );
}
