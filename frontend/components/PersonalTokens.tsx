'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  List,
  ListItem,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { ConfirmActionButton } from './ConfirmActionButton';
import { CopyableLink } from './CopyableLink';
import { SectionTitle } from './SectionTitle';
import { TextLink } from './TextLink';
import { API_REFERENCE_PATH, DEVELOPERS_PATH } from '@/lib/developerDocs';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { describeFailure } from '@/lib/failure';
import { lifetimeLabel, personalScopeSentence } from '@/lib/personalTokens';
import type { CreatedPersonalTokenResponse, PersonalTokensResponse } from '@/lib/api-types';

/** The JSON `{error, message}` the token routes answer with. */
async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

/** The "Personal API tokens" section of the Connected apps page
 * (docs/personal-api-tokens.md): the visitor's working tokens with Revoke
 * and Revoke all, and a form to create one. A new token is shown once,
 * here, with a Copy button; Distant Signal keeps only its hash, so leaving
 * the page drops it.
 *
 * Rendered only while the feature is on (`PersonalTokensSection` gets no
 * data otherwise). */
export function PersonalTokens({
  data,
  headingOrder = 2,
}: {
  data: PersonalTokensResponse;
  /** The level of this component's heading, below the page's own. */
  headingOrder?: 2 | 3;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [lifetime, setLifetime] = useState(String(data.defaultLifetimeDays));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedPersonalTokenResponse | null>(null);

  const atLimit = data.tokens.length >= data.maxActive;
  const canCreate = name.trim() !== '' && scopes.length > 0 && !atLimit;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/account/personal-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scopes, lifetimeDays: Number(lifetime) }),
      });
      if (response.ok) {
        setCreated((await response.json()) as CreatedPersonalTokenResponse);
        setName('');
        setScopes([]);
        router.refresh();
        return;
      }
      const code = await errorCode(response);
      setError(
        code === 'token_limit'
          ? `You can have up to ${data.maxActive} tokens. Revoke one first.`
          : response.status === 401
            ? 'Your session has ended. Log in again, then reload this page.'
            : describeFailure('create', 'the token', response.status),
      );
    } catch {
      setError(describeFailure('create', 'the token'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm" component="section" aria-labelledby="personal-tokens-heading">
      <SectionTitle order={headingOrder} id="personal-tokens-heading">
        Personal API tokens
      </SectionTitle>
      <Text size="sm">
        A token lets something you run yourself, such as a home dashboard or a phone shortcut, read your Distant Signal
        data. It can only read, never change anything. Anyone with the token can read what it allows, so keep it
        private.
      </Text>
      <Text size="sm">
        <TextLink href={DEVELOPERS_PATH} underline="always" inline>
          How to use a token
        </TextLink>
        {' · '}
        <TextLink href={API_REFERENCE_PATH} underline="always" inline>
          API reference
        </TextLink>
      </Text>
      {data.apiBaseUrl && (
        <Text size="sm">
          Send it as{' '}
          <Text span ff="monospace">
            Authorization: Bearer
          </Text>{' '}
          followed by the token, to{' '}
          <Text span ff="monospace">
            {data.apiBaseUrl}
          </Text>
          .
        </Text>
      )}

      {created && (
        <Alert color="green" title={`Token "${created.name}" created`}>
          <Stack gap="xs">
            <Text size="sm">Copy it now. You won&apos;t see it again.</Text>
            <CopyableLink value={created.token} label="Your new token" monospace />
          </Stack>
        </Alert>
      )}

      {data.tokens.length === 0 && <Text c="dimmed">You have no tokens.</Text>}
      {data.tokens.map((token) => (
        <Card key={token.id} withBorder>
          <Stack gap="xs" align="flex-start">
            <Text fw={600}>{token.name}</Text>
            <Text size="sm" c="dimmed">
              Ends in{' '}
              <Text span ff="monospace">
                {token.hint}
              </Text>
            </Text>
            <List size="sm">
              {token.scopes.map((scope) => (
                <ListItem key={scope}>{personalScopeSentence(scope)}</ListItem>
              ))}
            </List>
            <Text size="sm" c="dimmed">
              Created {formatDateTime(token.createdAt)}. Expires {formatDate(token.expiresAt)}.{' '}
              {token.lastUsedAt ? `Last used ${formatDateTime(token.lastUsedAt)}.` : 'Never used.'}
            </Text>
            <ConfirmActionButton
              label="Revoke"
              actionName={`revoke ${token.name}`}
              title={`Revoke "${token.name}"?`}
              request={() => fetch(`/api/account/personal-tokens/${token.id}`, { method: 'DELETE' })}
              failure={['revoke', 'the token']}
              loginPrompt="Log in to revoke it"
            >
              It will stop working straight away. Anything using it will need a new token.
            </ConfirmActionButton>
          </Stack>
        </Card>
      ))}
      {data.tokens.length >= 2 && (
        <Group>
          <ConfirmActionButton
            label="Revoke all tokens"
            actionName="revoke all tokens"
            title="Revoke all your tokens?"
            request={() => fetch('/api/account/personal-tokens', { method: 'DELETE' })}
            failure={['revoke', 'your tokens']}
            loginPrompt="Log in to revoke them"
          >
            Every token will stop working straight away.
          </ConfirmActionButton>
        </Group>
      )}

      <Card withBorder>
        <Stack gap="sm">
          <Text fw={600}>Create a token</Text>
          {atLimit ? (
            <Text size="sm">
              You have {data.maxActive} tokens, the most you can have. Revoke one to create another.
            </Text>
          ) : (
            <>
              <TextInput
                label="Name"
                description="So you can tell your tokens apart, for example Kitchen display."
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <Checkbox.Group label="It will be able to:" value={scopes} onChange={setScopes}>
                <Stack gap="xs" mt="xs">
                  {data.scopes.map((scope) => (
                    <Checkbox key={scope.name} value={scope.name} label={personalScopeSentence(scope.name)} />
                  ))}
                </Stack>
              </Checkbox.Group>
              <NativeSelect
                label="Expires after"
                value={lifetime}
                onChange={(event) => setLifetime(event.currentTarget.value)}
                data={data.lifetimes.map((days) => ({ value: String(days), label: lifetimeLabel(days) }))}
              />
              <Text size="sm" c="dimmed">
                A token also stops working after 90 days without use.
              </Text>
              {error && (
                <Alert color="red" title="Couldn't create the token">
                  {error}
                </Alert>
              )}
              <Group>
                <Button onClick={() => void create()} loading={busy} disabled={!canCreate}>
                  Create token
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
