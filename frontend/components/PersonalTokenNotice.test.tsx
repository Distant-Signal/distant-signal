import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { PersonalTokenNotice } from './PersonalTokenNotice';
import type { PersonalTokenRow } from '@/lib/api-types';
import { testTokenId } from '@/test/apiDefaults';
import { ID_SHAPES } from '@/test/zeroNumericIds';

const notice: PersonalTokenRow = {
  id: 7,
  publicId: testTokenId(7),
  name: 'Kitchen display',
  hint: 'AbC1',
  scopes: ['lines:read'],
  createdAt: '2026-11-03T09:00:00Z',
  expiresAt: '2027-02-01T09:00:00Z',
  lastUsedAt: null,
};

const title = 'An API token called "Kitchen display" was created';

describe.each(ID_SHAPES)('PersonalTokenNotice (%s)', (_name, shape) => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('names the token, when it was created, and where to revoke it', async () => {
    renderWithMantine(<PersonalTokenNotice notice={shape(notice)} />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revoke it in Connected apps' })).toHaveAttribute(
      'href',
      '/account/connected-apps',
    );
  });

  it('stays dismissed for that token, and shows again for a new one', async () => {
    const { unmount } = renderWithMantine(<PersonalTokenNotice notice={shape(notice)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(title)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(`personal-token-notice-dismissed:${testTokenId(7)}`)).toBe('1');
    unmount();
    renderWithMantine(<PersonalTokenNotice notice={shape(notice)} />);
    expect(screen.queryByText(title)).not.toBeInTheDocument();
    renderWithMantine(<PersonalTokenNotice notice={shape({ ...notice, id: 8, publicId: testTokenId(8) })} />);
    expect(await screen.findByText(title)).toBeInTheDocument();
  });
});
