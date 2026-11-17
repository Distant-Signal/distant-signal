import { describe, it, expect, beforeEach } from 'vitest';
import { getAnthropicApiKey, setAnthropicApiKey, clearAnthropicApiKey } from './anthropicKey';

describe('anthropicKey storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns null before any key is set', () => {
    expect(getAnthropicApiKey()).toBeNull();
  });

  it('round-trips a key through sessionStorage', () => {
    setAnthropicApiKey('sk-ant-test-key');
    expect(getAnthropicApiKey()).toBe('sk-ant-test-key');
  });

  it('clears a stored key', () => {
    setAnthropicApiKey('sk-ant-test-key');
    clearAnthropicApiKey();
    expect(getAnthropicApiKey()).toBeNull();
  });
});
