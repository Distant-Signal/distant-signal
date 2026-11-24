'use client';

import { useEffect, useState } from 'react';
import { useMounted } from '@mantine/hooks';
import { Button, Group, PasswordInput, Stack, Text } from '@mantine/core';
import { GatedButton } from '@/components/GatedButton';
import { missingFieldsReason } from '@/lib/missingFields';
import { getAnthropicApiKey, setAnthropicApiKey, clearAnthropicApiKey } from '@/lib/anthropicKey';

/** The visitor's own Claude API key for "Ask about trains", on
 * /account/preferences (client-side-tokens design doc, Decision 6). It used
 * to sit at the top of /chat; the chat page now links here.
 *
 * The "kept in this browser tab" sentence is a trust requirement, not polish:
 * the key never reaches a Distant Signal server, which only has value if
 * the visitor is told so.
 *
 * `sessionStorage` doesn't exist during SSR, so `hasKey` starts at `false`
 * and picks up the stored value only after mount. */
export function ClaudeKeySettings() {
  const mounted = useMounted();
  const [hasKey, setHasKey] = useState(false);
  const [input, setInput] = useState('');
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage only after mount, so the server and first client render agree
    setHasKey(getAnthropicApiKey() !== null);
  }, [mounted]);

  const displayedHasKey = mounted ? hasKey : false;

  function handleSave() {
    if (!input.trim()) return;
    setAnthropicApiKey(input.trim());
    setInput('');
    setHasKey(true);
    setSavedMessage(true);
  }

  function handleClear() {
    clearAnthropicApiKey();
    setHasKey(false);
    setSavedMessage(false);
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {displayedHasKey ? 'Key saved for this tab.' : 'No key set.'}
      </Text>
      <Group align="flex-end">
        <PasswordInput
          label="Claude API key"
          description="Kept in this browser tab until you close it, and sent only to Anthropic. Distant Signal's servers never see it. You will need to enter it again in a new tab."
          placeholder="sk-ant-"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          flex={1}
          miw={0}
        />
        <GatedButton onClick={handleSave} blockedReason={missingFieldsReason(input.trim() ? [] : ['Claude API key'])}>
          Save
        </GatedButton>
        {displayedHasKey && (
          <Button variant="subtle" color="red" onClick={handleClear}>
            Clear
          </Button>
        )}
      </Group>
      {savedMessage && (
        <Text size="xs" c="dimmed" role="status">
          Saved for this tab.
        </Text>
      )}
    </Stack>
  );
}
