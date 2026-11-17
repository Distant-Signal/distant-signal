import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteGroup } from './groupDelete';

describe('deleteGroup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the shown member count and returns a success untouched', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const onChanged = vi.fn();

    const response = await deleteGroup('grp-1', 3, onChanged);

    expect(fetch).toHaveBeenCalledWith('/api/groups/grp-1?expectedMemberCount=3', { method: 'DELETE' });
    expect(response.status).toBe(204);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('rewords group_changed with the current count and asks for a refresh', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'group_changed', message: 'This group has changed.', memberCount: 2 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const onChanged = vi.fn();

    const response = await deleteGroup('grp-1', 1, onChanged);

    expect(response.status).toBe(409);
    expect(await response.text()).toBe(
      'People have joined or left since you opened this page. The group now has 2 members. Check who is in the group, then try again.',
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('says "1 member" and tolerates a body without a count', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'group_changed', memberCount: 1 }), { status: 409 }),
    );
    expect(await (await deleteGroup('grp-1', 2, vi.fn())).text()).toContain('now has 1 member.');

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'group_changed' }), { status: 409 }));
    expect(await (await deleteGroup('grp-1', 2, vi.fn())).text()).toBe(
      'People have joined or left since you opened this page. Check who is in the group, then try again.',
    );
  });

  it('leaves any other 409 and any other error alone', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('something else', { status: 409 }));
    const onChanged = vi.fn();
    const other = await deleteGroup('grp-1', 1, onChanged);
    expect(await other.text()).toBe('something else');

    vi.mocked(fetch).mockResolvedValueOnce(new Response('nope', { status: 403 }));
    expect((await deleteGroup('grp-1', 1, onChanged)).status).toBe(403);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
