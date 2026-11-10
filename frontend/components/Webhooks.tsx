'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Group, NativeSelect, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { ConfirmActionButton } from './ConfirmActionButton';
import { CopyableLink } from './CopyableLink';
import { SectionTitle } from './SectionTitle';
import { formatDateTime } from '@/lib/dateFormat';
import { asSentence, describeFailure } from '@/lib/failure';
import type { CreatedWebhookResponse, WebhookDestination, WebhooksResponse } from '@/lib/api-types';

/** What the visitor sees for each preset. A new preset is a row here. */
const KIND_LABELS: Record<string, string> = {
  generic: 'Signed JSON',
  ntfy: 'ntfy',
  gotify: 'Gotify',
};

const ADDRESS_HINTS: Record<string, string> = {
  generic: 'The https address that receives each notification, for example https://example.org/hooks/trains.',
  ntfy: 'The topic address, for example https://ntfy.sh/my-trains, or your own server.',
  gotify: 'Your Gotify server, for example https://gotify.example.org.',
};

const SECRET_LABELS: Record<string, { label: string; description: string }> = {
  ntfy: { label: 'Access token (optional)', description: 'Only if the topic needs one.' },
  gotify: { label: 'App token', description: 'The token of the Gotify app that should receive them.' },
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/** The JSON `{error, message}` the webhook routes answer with. */
async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

function describeCreateFailure(code: string | null, status: number, max: number): string {
  if (code === 'webhook_limit') return `You can have up to ${max} destinations. Delete one first.`;
  if (code === 'webhook_exists') return 'You already have a destination at that address.';
  if (status === 400) {
    return "That address or secret isn't valid. Use a public https address, and check the type and token.";
  }
  return describeFailure('add', 'the destination', status);
}

function DestinationStatus({ destination }: { destination: WebhookDestination }) {
  if (!destination.enabled) {
    return (
      <Stack gap={2} align="flex-start">
        <Badge color="red" variant="light">
          Off
        </Badge>
        <Text size="sm">
          {destination.disabledReason ? asSentence(destination.disabledReason) : 'You turned this destination off.'}
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap={2} align="flex-start">
      <Badge color="green" variant="light">
        On
      </Badge>
      <Text size="sm" c="dimmed">
        {destination.lastSuccessAt
          ? `Last accepted ${formatDateTime(destination.lastSuccessAt)}.`
          : 'Nothing sent yet.'}
        {destination.lastError && destination.lastFailureAt
          ? ` Last problem ${formatDateTime(destination.lastFailureAt)}: ${asSentence(destination.lastError)}`
          : ''}
      </Text>
    </Stack>
  );
}

/** The "Webhooks" section of the Notifications page: the visitor's own
 * destinations for the notifications they get in the browser, with a form
 * to add one. A generic destination's signing secret is shown once, here;
 * leaving the page drops it.
 *
 * Rendered only while the feature is on (`WebhooksSection` gets no data
 * otherwise). */
export function Webhooks({ data, headingOrder = 2 }: { data: WebhooksResponse; headingOrder?: 2 | 3 }) {
  const router = useRouter();
  const [kind, setKind] = useState(data.kinds[0]?.kind ?? 'generic');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedWebhookResponse | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const secretRule = data.kinds.find((k) => k.kind === kind)?.secret ?? 'none';
  const secretLabel = SECRET_LABELS[kind];
  const atLimit = data.destinations.length >= data.maxDestinations;
  const canCreate = name.trim() !== '' && url.trim() !== '' && (secretRule !== 'required' || secret.trim() !== '');

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/account/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          url: url.trim(),
          ...(secretRule === 'none' || secret.trim() === '' ? {} : { secret: secret.trim() }),
        }),
      });
      if (response.ok) {
        setCreated((await response.json()) as CreatedWebhookResponse);
        setName('');
        setUrl('');
        setSecret('');
        router.refresh();
        return;
      }
      setError(describeCreateFailure(await errorCode(response), response.status, data.maxDestinations));
    } catch {
      setError(describeFailure('add', 'the destination'));
    } finally {
      setBusy(false);
    }
  }

  async function setEnabled(destination: WebhookDestination, enabled: boolean) {
    setRowError(null);
    try {
      const response = await fetch(`/api/account/webhooks/${destination.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      setRowError(describeFailure('update', 'the destination', response.status));
    } catch {
      setRowError(describeFailure('update', 'the destination'));
    }
  }

  return (
    <Stack gap="sm" component="section" aria-labelledby="webhooks-heading">
      <SectionTitle order={headingOrder} id="webhooks-heading">
        Webhooks
      </SectionTitle>
      <Text size="sm">
        Also send your notifications to a service or device you choose, such as ntfy or Gotify, or an address of your
        own. They follow the same settings as your browser notifications, including quiet hours and the trains you
        turned off. We send the notification&apos;s text, which includes your route, times and delays, and a link to the
        page it opens. That link, and the tag in the generic message, contain the numbers we use for your journey, leg
        or train. We never send your name, email or account ID.
      </Text>

      {created && (
        <Alert color="green" title={`Destination "${created.destination.name}" added`}>
          <Stack gap="xs">
            {created.secret ? (
              <>
                <Text size="sm">
                  Copy the signing secret now. You won&apos;t see it again. Use it to check the signature on each
                  message.
                </Text>
                <CopyableLink value={created.secret} label="Your signing secret" monospace />
              </>
            ) : (
              <Text size="sm">New notifications will be sent to it.</Text>
            )}
          </Stack>
        </Alert>
      )}

      {data.destinations.length === 0 && <Text c="dimmed">You have no webhook destinations.</Text>}
      {rowError && <Alert color="red">{rowError}</Alert>}
      {data.destinations.map((destination) => (
        <Card key={destination.id} withBorder>
          <Stack gap="xs" align="flex-start">
            <Text fw={600}>{destination.name}</Text>
            <Text size="sm" c="dimmed">
              {kindLabel(destination.kind)}
              {' to '}
              <Text span ff="monospace" className="ds-break-anywhere">
                {destination.url}
              </Text>
            </Text>
            <DestinationStatus destination={destination} />
            <Group gap="sm">
              <Button
                variant="default"
                size="xs"
                onClick={() => void setEnabled(destination, !destination.enabled)}
                aria-label={`${destination.enabled ? 'Turn off' : 'Turn on'} ${destination.name}`}
              >
                {destination.enabled ? 'Turn off' : 'Turn on'}
              </Button>
              <ConfirmActionButton
                label="Delete"
                actionName={`delete ${destination.name}`}
                title={`Delete "${destination.name}"?`}
                request={() => fetch(`/api/account/webhooks/${destination.id}`, { method: 'DELETE' })}
                failure={['delete', 'the destination']}
                loginPrompt="Log in to delete it"
              >
                Notifications will stop going to it straight away.
              </ConfirmActionButton>
            </Group>
          </Stack>
        </Card>
      ))}

      <Card withBorder>
        <Stack gap="sm">
          <Text fw={600}>Add a destination</Text>
          {atLimit ? (
            <Text size="sm">
              You have {data.maxDestinations} destinations, the most you can have. Delete one to add another.
            </Text>
          ) : (
            <>
              <NativeSelect
                label="Type"
                value={kind}
                onChange={(event) => {
                  setKind(event.currentTarget.value);
                  setSecret('');
                }}
                data={data.kinds.map((k) => ({ value: k.kind, label: kindLabel(k.kind) }))}
              />
              <TextInput
                label="Name"
                description="So you can tell them apart, for example My phone."
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <TextInput
                label="Address"
                description={ADDRESS_HINTS[kind] ?? 'The https address that receives each notification.'}
                value={url}
                maxLength={2048}
                onChange={(event) => setUrl(event.currentTarget.value)}
              />
              {secretLabel && (
                <PasswordInput
                  label={secretLabel.label}
                  description={secretLabel.description}
                  value={secret}
                  maxLength={512}
                  autoComplete="off"
                  onChange={(event) => setSecret(event.currentTarget.value)}
                />
              )}
              <Text size="sm" c="dimmed">
                Only public https addresses work. Private and local addresses are refused. If a destination keeps
                failing we turn it off and say why here.
              </Text>
              {error && <Alert color="red">{error}</Alert>}
              <Group>
                <Button onClick={() => void create()} loading={busy} disabled={!canCreate}>
                  Add destination
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
