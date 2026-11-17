import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { ClaudeKeySettings } from './ClaudeKeySettings';
import { getAnthropicApiKey } from '@/lib/anthropicKey';

describe('ClaudeKeySettings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('says where the key is kept, and that no key is set', () => {
    renderWithMantine(<ClaudeKeySettings />);
    expect(screen.getByLabelText('Claude API key')).toHaveAccessibleDescription(
      "Kept in this browser tab until you close it, and sent only to Anthropic. Distant Signal's servers never see it. You will need to enter it again in a new tab.",
    );
    expect(screen.getByText(/no key set/i)).toBeInTheDocument();
  });

  it('saves a key entered in the input', () => {
    renderWithMantine(<ClaudeKeySettings />);
    fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'sk-ant-abc123' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(getAnthropicApiKey()).toBe('sk-ant-abc123');
    expect(screen.getByText(/key saved/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved for this tab.');
  });

  it('masks a previously saved key rather than showing it in full', () => {
    setAnthropicApiKeyForTest('sk-ant-abcdefghijklmnop');
    renderWithMantine(<ClaudeKeySettings />);
    expect(screen.queryByDisplayValue('sk-ant-abcdefghijklmnop')).not.toBeInTheDocument();
    expect(screen.getByText(/key saved/i)).toBeInTheDocument();
  });

  it('clears a saved key', () => {
    setAnthropicApiKeyForTest('sk-ant-abc123');
    renderWithMantine(<ClaudeKeySettings />);
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(getAnthropicApiKey()).toBeNull();
    expect(screen.getByText(/no key set/i)).toBeInTheDocument();
  });
});

function setAnthropicApiKeyForTest(key: string) {
  sessionStorage.setItem('ds-anthropic-api-key', key);
}
