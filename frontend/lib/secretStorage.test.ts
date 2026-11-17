import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ANTHROPIC_API_KEY_STORAGE_KEY,
  clearSecretStorage,
  migrateLegacySecrets,
  secretStorage,
} from './secretStorage';
import { getAnthropicApiKey, setAnthropicApiKey } from './anthropicKey';
import { BrowserMcpOAuthProvider } from './mcpOAuthProvider';

describe('secretStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps secrets in sessionStorage and never in localStorage', () => {
    setAnthropicApiKey('sk-ant-test');
    new BrowserMcpOAuthProvider('https://example.test/chat/callback').saveTokens({
      access_token: 'tok',
      token_type: 'Bearer',
    });
    expect(sessionStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY)).toBe('sk-ant-test');
    expect(sessionStorage.getItem('ds-mcp-oauth:tokens')).not.toBeNull();
    expect(localStorage.length).toBe(0);
  });

  describe('migration', () => {
    it('moves legacy localStorage secrets into sessionStorage and removes the old copies', () => {
      localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, 'sk-ant-old');
      localStorage.setItem('ds-mcp-oauth:tokens', '{"access_token":"t","token_type":"Bearer"}');
      localStorage.setItem('ds-mcp-oauth:future-key', 'x');
      localStorage.setItem('ds-color-scheme', 'dark');
      migrateLegacySecrets();
      expect(sessionStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY)).toBe('sk-ant-old');
      expect(sessionStorage.getItem('ds-mcp-oauth:tokens')).toBe('{"access_token":"t","token_type":"Bearer"}');
      expect(sessionStorage.getItem('ds-mcp-oauth:future-key')).toBe('x');
      expect(localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('ds-mcp-oauth:tokens')).toBeNull();
      expect(localStorage.getItem('ds-mcp-oauth:future-key')).toBeNull();
      expect(localStorage.getItem('ds-color-scheme')).toBe('dark');
    });

    it('does not overwrite a newer value already in the session', () => {
      sessionStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, 'sk-ant-new');
      localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, 'sk-ant-old');
      migrateLegacySecrets();
      expect(sessionStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY)).toBe('sk-ant-new');
      expect(localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY)).toBeNull();
    });

    it('runs on first read, so an existing visitor keeps their key', () => {
      localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, 'sk-ant-old');
      expect(getAnthropicApiKey()).toBe('sk-ant-old');
      expect(localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY)).toBeNull();
    });

    it('never throws when storage is blocked', () => {
      vi.stubGlobal('localStorage', {
        get length(): number {
          throw new Error('SecurityError');
        },
      });
      try {
        expect(() => migrateLegacySecrets()).not.toThrow();
        expect(secretStorage()).toBe(sessionStorage);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('clearSecretStorage', () => {
    it('clears both stores and leaves unrelated keys', () => {
      sessionStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, 'x');
      sessionStorage.setItem('ds-mcp-oauth:tokens', 'x');
      localStorage.setItem('ds-mcp-oauth:client-information', 'x');
      localStorage.setItem('ds-pride', 'on');
      clearSecretStorage();
      expect(sessionStorage.length).toBe(0);
      expect(localStorage.length).toBe(1);
      expect(localStorage.getItem('ds-pride')).toBe('on');
    });
  });
});
