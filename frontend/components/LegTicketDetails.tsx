'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, FileButton, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { ButtonSpinner } from './LoadingText';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { formatDate } from '@/lib/dateFormat';
import { LEG_TICKET_TYPE_LABELS, legTicketSummary } from '@/lib/legTicket';
import type { LegTicket, LegTicketPrefill, LegTicketRequest, LegTicketType } from '@/lib/types';

const TYPE_OPTIONS = (Object.keys(LEG_TICKET_TYPE_LABELS) as LegTicketType[]).map((value) => ({
  value,
  label: LEG_TICKET_TYPE_LABELS[value],
}));

function isTicketType(value: string | null): value is LegTicketType {
  return value !== null && value in LEG_TICKET_TYPE_LABELS;
}

/** What a failed Wallet read says (the api's 413/415/422/503/504). */
function walletFailure(status: number): string {
  switch (status) {
    case 413:
      return 'That file is too large to be a Wallet pass (8 MB limit). Fill in the details yourself.';
    case 415:
      return "That isn't an Apple Wallet pass. Fill in the details yourself.";
    case 503:
      return 'Too many passes are being read right now. Try again in a minute.';
    case 504:
      return 'That pass took too long to read. Fill in the details yourself.';
    default:
      return "Couldn't read this pass. Fill in the details yourself.";
  }
}

/** A journey leg's ticket details, for its owner (2026-11-06): the ticket
 * type, whether it is valid on one train company only, and a name. All
 * optional, none needed for Delay Repay: they only say whether the
 * 120-minute band pays on a single or a return, and which company's scheme
 * applies to a one-company ticket. An Apple Wallet pass fills in the type
 * (and checks its date against the leg's) without being kept; the owner
 * still saves. `PUT`/`DELETE /Journeys/{id}/legs/{legId}/ticket`, and
 * `POST .../ticket/pkpass` for the pass. */
export function LegTicketDetails({
  journeyId,
  legId,
  ticket,
  operatorName,
}: {
  journeyId: number;
  legId: number;
  ticket: LegTicket | null;
  /** The train's company, to name in the one-company option. */
  operatorName: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [ticketType, setTicketType] = useState<LegTicketType>(ticket?.ticketType ?? 'unknown');
  const [operatorOnly, setOperatorOnly] = useState(ticket?.operatorOnly ?? false);
  const [name, setName] = useState(ticket?.name ?? '');
  const [fromWallet, setFromWallet] = useState<{ departureDate: string | null } | null>(null);
  const [walletNote, setWalletNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/Journeys/${String(journeyId)}/legs/${String(legId)}/ticket`;

  function open() {
    setTicketType(ticket?.ticketType ?? 'unknown');
    setOperatorOnly(ticket?.operatorOnly ?? false);
    setName(ticket?.name ?? '');
    setFromWallet(null);
    setWalletNote(null);
    setError(null);
    setEditing(true);
  }

  async function readPass(file: File | null) {
    if (!file) return;
    setReading(true);
    setWalletNote(null);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      // No Content-Type: the browser sets the multipart boundary itself.
      const response = await fetch(`${base}/pkpass`, { method: 'POST', body });
      if (!response.ok) {
        setWalletNote(walletFailure(response.status));
        return;
      }
      const prefill = (await response.json()) as LegTicketPrefill;
      setTicketType(prefill.ticketType);
      setOperatorOnly(prefill.operatorOnly);
      setFromWallet({ departureDate: prefill.departureDate });
      setWalletNote(
        prefill.departureDateMatchesLeg === false && prefill.departureDate
          ? `Filled in from your pass. It's for ${formatDate(prefill.departureDate)}, not this leg's date: check it's the right ticket.`
          : 'Filled in from your pass. Check the details, then save.',
      );
    } catch {
      setWalletNote(walletFailure(0));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: LegTicketRequest = {
        ticketType,
        operatorOnly,
        name: name.trim() === '' ? null : name.trim(),
        source: fromWallet ? 'wallet' : (ticket?.source ?? 'manual'),
        departureDate: fromWallet ? fromWallet.departureDate : (ticket?.departureDate ?? null),
      };
      const response = await fetch(base, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await failureFromResponse('save', 'your ticket details', response));
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError(describeFailure('save', 'your ticket details'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(base, { method: 'DELETE' });
      if (!response.ok) {
        setError(await failureFromResponse('remove', 'your ticket details', response));
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError(describeFailure('remove', 'your ticket details'));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Group gap="xs" justify="space-between" wrap="wrap">
        {ticket ? (
          <Text size="sm">{legTicketSummary(ticket, operatorName)}</Text>
        ) : (
          <Text size="sm" c="dimmed">
            No ticket details. None needed for Delay Repay.
          </Text>
        )}
        <Button size="xs" variant="default" onClick={open}>
          {ticket ? 'Edit ticket details' : 'Add ticket details'}
        </Button>
      </Group>
    );
  }

  return (
    <Stack gap="xs" component="section" aria-label="Ticket details">
      <Text size="sm" c="dimmed">
        Optional. The ticket type says whether a long delay pays on a single or a return.
      </Text>
      <Group gap="xs" align="center">
        <FileButton onChange={(file) => void readPass(file)} accept=".pkpass,application/vnd.apple.pkpass">
          {(props) => (
            <Button {...props} size="xs" variant="light" disabled={reading || saving}>
              {reading ? <ButtonSpinner /> : null}
              Fill in from an Apple Wallet pass
            </Button>
          )}
        </FileButton>
      </Group>
      {walletNote && (
        <Text size="sm" role="status">
          {walletNote}
        </Text>
      )}
      <Select
        label="Ticket type"
        data={TYPE_OPTIONS}
        value={ticketType}
        onChange={(value) => {
          if (isTicketType(value)) setTicketType(value);
        }}
        allowDeselect={false}
        w={{ base: '100%', xs: 260 }}
      />
      <Checkbox
        label={operatorName ? `Only valid on ${operatorName} trains` : 'Only valid on this train company'}
        checked={operatorOnly}
        onChange={(event) => setOperatorOnly(event.currentTarget.checked)}
      />
      <TextInput
        label="Name"
        description="Optional, to tell your tickets apart."
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.currentTarget.value)}
        w={{ base: '100%', xs: 260 }}
      />
      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}
      <Group gap="xs">
        <Button size="xs" onClick={() => void save()} disabled={saving || reading}>
          {saving ? <ButtonSpinner /> : null}
          Save
        </Button>
        <Button size="xs" variant="default" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </Button>
        {ticket && (
          <Button size="xs" variant="subtle" color="red" onClick={() => void remove()} disabled={saving}>
            Remove ticket details
          </Button>
        )}
      </Group>
    </Stack>
  );
}
