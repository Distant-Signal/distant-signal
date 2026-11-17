import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserSecretsGuard } from './BrowserSecretsGuard';

describe('BrowserSecretsGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears the secrets when the session is gone', () => {
    sessionStorage.setItem('ds-anthropic-api-key', 'sk-ant-x');
    sessionStorage.setItem('ds-mcp-oauth:tokens', '{}');
    localStorage.setItem('ds-mcp-oauth:client-information', '{}');
    localStorage.setItem('ds-pride', 'on');
    render(<BrowserSecretsGuard signedIn={false} />);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem('ds-mcp-oauth:client-information')).toBeNull();
    expect(localStorage.getItem('ds-pride')).toBe('on');
  });

  it('keeps the secrets for a logged-in visitor and migrates legacy ones', () => {
    sessionStorage.setItem('ds-mcp-oauth:tokens', '{}');
    localStorage.setItem('ds-anthropic-api-key', 'sk-ant-old');
    render(<BrowserSecretsGuard signedIn />);
    expect(sessionStorage.getItem('ds-mcp-oauth:tokens')).toBe('{}');
    expect(sessionStorage.getItem('ds-anthropic-api-key')).toBe('sk-ant-old');
    expect(localStorage.getItem('ds-anthropic-api-key')).toBeNull();
  });
});
