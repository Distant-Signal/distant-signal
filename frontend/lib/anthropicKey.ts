import { ANTHROPIC_API_KEY_STORAGE_KEY, secretStorage } from './secretStorage';

// A per-tab, browser-local credential (`sessionStorage`, see
// `lib/secretStorage.ts`): kept across reloads, forgotten when the tab
// closes. NEVER sent to any Distant Signal server -- this module's only
// consumers are the direct-to-Anthropic client construction in ChatPanel
// and ClaudeKeySettings' own UI.
export { ANTHROPIC_API_KEY_STORAGE_KEY };

export function getAnthropicApiKey(): string | null {
  return secretStorage().getItem(ANTHROPIC_API_KEY_STORAGE_KEY);
}

export function setAnthropicApiKey(key: string): void {
  secretStorage().setItem(ANTHROPIC_API_KEY_STORAGE_KEY, key);
}

export function clearAnthropicApiKey(): void {
  secretStorage().removeItem(ANTHROPIC_API_KEY_STORAGE_KEY);
}
