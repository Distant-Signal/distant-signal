import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { visibleText } from '@/test/routeText';
import PrivacyPage from './page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

function retentionText(title: string): string {
  const heading = screen.getByRole('heading', { name: title });
  return heading.parentElement?.textContent ?? '';
}

// LEG-28 / DQ7: the notice states the api's actual retention settings.
describe('PrivacyPage retention copy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function render(env: Record<string, string> = {}) {
    vi.stubEnv('LEGAL_PAGES_PREVIEW', 'true');
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    renderWithMantine(<PrivacyPage />);
  }

  it('mentions the 12-month push-subscription prune', () => {
    render();
    expect(retentionText('Push notifications')).toMatch(/have not logged in .* for 12 months/);
  });

  it('says what ticket details hold, and that a Wallet pass is never stored', () => {
    render();
    const section = retentionText('Tickets');
    expect(section).toMatch(/Wallet passes are not kept at all/);
  });

  it('states the 18-month travel-date limit for tracked trains, journeys and tickets', () => {
    render();
    expect(retentionText('Tracked trains, journeys and regular journeys')).toMatch(/18 months after the travel date/);
    expect(retentionText('Tickets')).toMatch(/18 months after the travel date/);
  });

  it('says nothing about inactive-account deletion while it is off (the default)', () => {
    render();
    expect(retentionText('Your account')).not.toMatch(/do not log in/);
  });

  it('states the 730-day inactive-account deletion once it is enabled', () => {
    render({ RETENTION_INACTIVE_ACCOUNT_DAYS: '730' });
    expect(retentionText('Your account')).toMatch(/If you do not log in for 24 months .* we delete your account/);
  });

  // DS-379: the regular-journey rule appears only while the api has it on.
  it('says nothing about the regular-journey rule while it is off (the default)', () => {
    render();
    expect(retentionText('Tracked trains, journeys and regular journeys')).not.toMatch(/go sooner/);
  });

  it('states the regular-journey rule and what keeps a journey for Delay Repay once it is on', () => {
    render({ RETENTION_REGULAR_JOURNEY_DAYS: '90' });
    const text = retentionText('Tracked trains, journeys and regular journeys');
    expect(text).toMatch(/how late each of your trains arrived and whether it was cancelled/);
    expect(text).toMatch(/Journeys made from a regular journey go sooner: 3 months after the travel date/);
    expect(text).toMatch(
      /you added ticket details to one of its trains, one was cancelled or arrived 15 or more minutes late, or you missed a connection/,
    );
    expect(text).toMatch(/kept like other journeys\. Regular journeys: until you delete them/);
  });

  // docs/personal-data-retention.md: the SFTP server's 7/90/400-day log tiers.
  it('states the file-transfer server log tiers', () => {
    render();
    const text = retentionText('Connections to our file-transfer server');
    expect(text).toMatch(/31 days for connections that never try to log in/);
    expect(text).toMatch(/90 days for failed logins and blocked addresses/);
    expect(text).toMatch(/400 days for successful logins and file transfers/);
  });

  it('drops a limit that is switched off', () => {
    render({ RETENTION_STALE_PUSH_SUBSCRIPTION_DAYS: '0', RETENTION_PAST_TRAVEL_DAYS: '0' });
    expect(retentionText('Push notifications')).not.toMatch(/have not logged in/);
    expect(retentionText('Tickets')).not.toMatch(/travel date/);
  });
});

// The 2026-10-14 delegated-access spec: scopes, expiry, revocation and the
// 7-day log and 30-day deletion-history retention.
describe('PrivacyPage assistant connection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('states what the assistant can do, how to disconnect and what is kept', () => {
    vi.stubEnv('LEGAL_PAGES_PREVIEW', 'true');
    renderWithMantine(<PrivacyPage />);
    const text = retentionText('Connecting your AI assistant');
    expect(text).toMatch(/delete only journeys it saved itself that are not shared/);
    expect(text).toMatch(/only if a group owner or admin has turned this on/);
    expect(text).toMatch(/journey names are hidden from it/);
    expect(text).toMatch(/Connected apps/);
    expect(text).toMatch(/90 days without use/);
    expect(text).toMatch(/log out of our login service/);
    expect(text).toMatch(/keep these logs for 31 days/);
    expect(text).toMatch(/for 30 days/);
    expect(text).toMatch(/After a connection ends we keep a record of it .* for one year, then delete it\./);
  });
});

// DS-301: the move of public login to a login service of its own. The api no
// longer holds the Discord account ID, so the notice must not say it does.
describe('PrivacyPage login service', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function render() {
    vi.stubEnv('LEGAL_PAGES_PREVIEW', 'true');
    renderWithMantine(<PrivacyPage />);
  }

  it('no longer lists a Discord account ID in the account data', () => {
    render();
    const text = retentionText('Your account');
    expect(text).not.toMatch(/Discord/);
    expect(text).toMatch(/Why: To create and run your account\./);
  });

  it('describes the login service and says the copied Discord account IDs are deleted', () => {
    render();
    const text = retentionText('Logging in');
    expect(text).toMatch(/used only for Distant Signal and is run by us/);
    expect(text).toMatch(/Discord tells our login service your Discord account ID, username and display name/);
    expect(text).not.toMatch(/copy of your Discord profile picture/);
    expect(text).toMatch(/does not ask the provider for your email address and does not store one/);
    expect(text).toMatch(
      /When you log in with Google, Google tells our login service your Google account ID and your name/,
    );
    expect(text).toMatch(/asks Google for only your name and account ID, not your email address or profile picture/);
    expect(text).toMatch(
      /It gives Distant Signal an ID for your account, your username and display name, and your access groups\. Distant Signal does not store your profile picture/,
    );
    expect(text).toMatch(
      /IP address, browser details, approximate location and internet provider, and deletes it after /,
    );
    expect(text).toMatch(
      /Each time you log in it also saves the access key the provider gives it \(and a key to renew it/,
    );
    expect(text).toMatch(
      /Nothing uses them\. It removes them every night, so they are held for up to about 24 hours, and also deletes them if your login service account is deleted/,
    );
    expect(retentionText('Technical logs and IP addresses')).toMatch(
      /browser details and a shortened version of your IP address \(the last part removed\) when you log in\. Older log lines written before 28 November 2026 can still hold the full address until they are deleted/,
    );
    expect(text).toMatch(/keeps your account until you ask us to delete it \(see Your rights\)/);
    expect(text).toMatch(/backed up each night\. The copies are encrypted and kept for 7 days/);
    expect(text).toMatch(
      /we used the Discord account ID of each existing account from the login service we used before, once, to link your first login/,
    );
    expect(text).toMatch(/We have now deleted the copies we held/);
    expect(text).not.toMatch(/if you log in with Discord, your Discord account ID/);
  });

  it('says what Microsoft tells our login service and what it keeps', () => {
    vi.stubEnv('LEGAL_PAGES_PREVIEW', 'true');
    renderWithMantine(<PrivacyPage />);
    const text = retentionText('Logging in');
    expect(text).toMatch(
      /When you log in with Microsoft, Microsoft tells our login service your Microsoft account ID and your display name\. Our login service keeps these\./,
    );
    expect(text).toMatch(/Microsoft login is for personal Microsoft accounts/);
    expect(text).toMatch(
      /does not ask for or keep your email address or profile picture, and does not receive or use your Microsoft contacts, files, mail or calendar/,
    );
    expect(text).not.toMatch(/asks Microsoft for/);
  });

  it('says deleting the account leaves the login service account, and how to have it deleted', () => {
    render();
    const text = retentionText('Your rights');
    expect(text).toMatch(
      /does not delete your Discord, Google or Microsoft account, or your account on our login service/,
    );
    expect(text).toMatch(/Distant Signal's access in that provider's account settings/);
    expect(text).toMatch(/For Google, this is the third-party access page in your Google account/);
    expect(text).toMatch(
      /Removing access there does not delete what our login service has already kept; email us for that/,
    );
    expect(text).toMatch(/To have your login service account deleted, email/);
  });
});

describe('PrivacyPage Google and Microsoft login', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names Google and Microsoft as separate controllers and in the transfers', () => {
    vi.stubEnv('LEGAL_PAGES_PREVIEW', 'true');
    renderWithMantine(<PrivacyPage />);
    expect(retentionText('Who we share it with')).toMatch(
      /Discord, Google or Microsoft, if you log in with that provider\. Each is a separate controller/,
    );
    expect(retentionText('International transfers')).toMatch(/If you log in with Discord, Google or Microsoft/);
  });
});

describe('PrivacyPage external links', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["Anthropic's terms", 'https://www.anthropic.com/legal'],
    ['ico.org.uk', 'https://ico.org.uk/make-a-complaint/'],
  ])('%s opens a new tab and says so, keeping its visible text and inherited colour', (text, href) => {
    vi.stubEnv('LEGAL_PAGES_PREVIEW', 'true');
    renderWithMantine(<PrivacyPage />);
    const link = screen.getByRole('link', { name: `${text} (opens in a new tab)` });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('data-text-link-tone', 'inherit');
    expect(link).toHaveAttribute('data-text-link', 'always');
    expect(visibleText(link)).toBe(text);
    expect(link.querySelector('svg[data-icon="external-link"]')).toHaveAttribute('aria-hidden', 'true');
  });
});
