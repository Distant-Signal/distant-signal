import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetClientIpWarningForTests, clientIpFromHeaders } from './clientIp';

describe('clientIpFromHeaders', () => {
  beforeEach(() => {
    __resetClientIpWarningForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('trusts a literal-IP CF-Connecting-IP and nothing else', () => {
    expect(clientIpFromHeaders(new Headers({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIpFromHeaders(new Headers({ 'cf-connecting-ip': 'nope' }))).toBeNull();
    expect(
      clientIpFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.7' })),
    ).toBeNull();
  });

  describe('with TRUSTED_PROXY_SECRET set', () => {
    beforeEach(() => {
      vi.stubEnv('TRUSTED_PROXY_SECRET', 'edge-secret');
    });

    it('honours CF-Connecting-IP only with the matching secret header', () => {
      const ip = { 'cf-connecting-ip': '203.0.113.7' };
      expect(clientIpFromHeaders(new Headers({ ...ip, 'x-ds-proxy-secret': 'edge-secret' }))).toBe('203.0.113.7');
      expect(clientIpFromHeaders(new Headers(ip))).toBeNull();
      expect(clientIpFromHeaders(new Headers({ ...ip, 'x-ds-proxy-secret': 'wrong-secret' }))).toBeNull();
      expect(clientIpFromHeaders(new Headers({ ...ip, 'x-ds-proxy-secret': 'short' }))).toBeNull();
    });
  });

  describe('the missing-address warning', () => {
    it('is logged once in production, and not in other modes', () => {
      const write = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.stubEnv('LOG_FORMAT', 'pretty');
      vi.stubEnv('NODE_ENV', 'test');
      clientIpFromHeaders(new Headers());
      expect(write).not.toHaveBeenCalled();

      vi.stubEnv('NODE_ENV', 'production');
      clientIpFromHeaders(new Headers());
      clientIpFromHeaders(new Headers());
      expect(write).toHaveBeenCalledTimes(1);
      expect(String(write.mock.calls[0]?.[0])).toContain('CF-Connecting-IP missing');
    });
  });
});
