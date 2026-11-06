import Link from 'next/link';
import { Group, Stack, Text, Title, VisuallyHidden } from '@mantine/core';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { TrackedTrainListItem } from '@/lib/types';
import { DelayBadge } from '@/components/DelayBadge';
import { IrelandAttributionNote } from '@/components/IrelandAttributionNote';
import { LastUpdated } from '@/components/LastUpdated';
import { SectionTitle } from '@/components/SectionTitle';
import { ServiceListNotice, ServiceRowList } from '@/components/ServiceRow';
import { ShareButton } from '@/components/ShareButton';
import { TextLink } from '@/components/TextLink';
import { TrackThisTrainButton } from '@/components/TrackThisTrainButton';
import { TrackedTrainOwnerControls } from '@/components/TrackedTrainOwnerControls';
import { getIrelandTrain, getMyTrackedTrains } from '@/lib/api';
import { formatTime } from '@/lib/dateFormat';
import { describeFailure } from '@/lib/failure';
import {
  IRELAND_SERVICE_DATE,
  IRELAND_STATION_CODE,
  IRELAND_TRAIN_CODE,
  type IrelandNetworkInfo,
  type IrelandTrain,
  irelandNetworkHref,
  irelandTrainHref,
  irelandTrainIdentifiers,
  irelandTrainName,
  isTrackableIrishDate,
  lastLocationText,
  networkBySlug,
  trainCallRows,
} from '@/lib/ireland';
import { createLogger } from '@/lib/logger';
import { pageMetadata } from '@/lib/pageMetadata';
import classes from '@/components/ServiceRow.module.css';

const log = createLogger('app/island-of-ireland/train');

interface Params {
  params: Promise<{ network: string; train: string; date: string }>;
}

interface PageProps extends Params {
  /** `from`: the live code of the board the visitor came from. */
  searchParams?: Promise<{ from?: string | string[] }>;
}

/** The URL's network, train code and date, or not found: only Iarnród
 * Éireann has live boards, so only it has train pages. */
function parse(network: string, segment: string, date: string): { info: IrelandNetworkInfo; code: string } {
  const info = networkBySlug(network);
  if (info?.network !== 'republic-of-ireland') notFound();
  let code: string;
  try {
    code = decodeURIComponent(segment).trim().toUpperCase();
  } catch {
    notFound();
  }
  if (!IRELAND_TRAIN_CODE.test(code) || !IRELAND_SERVICE_DATE.test(date)) notFound();
  return { info, code };
}

/** The train, `null` when no board has shown it, or `'failed'`. */
async function loadTrain(code: string, date: string): Promise<IrelandTrain | null | 'failed'> {
  try {
    return await getIrelandTrain(code, date);
  } catch (err) {
    log.warn('island of Ireland train failed', { train: code, date, error: err });
    return 'failed';
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { network, train: segment, date } = await params;
  const { info, code } = parse(network, segment, date);
  // The page's own fetch, deduped by Next's request memoization.
  const train = await loadTrain(code, date);
  if (train === null) notFound();
  const title = train === 'failed' ? `Train ${code}` : irelandTrainName(train);
  return pageMetadata(title, `${title}: calling points and live running from ${info.name}'s departure boards.`, {
    path: irelandTrainHref(info.slug, code, date),
    noindex: true,
  });
}

/** What the boards say about the train now, in words (design §6.2): a
 * delay only while it reports, never a guessed "On time". */
function LiveState({ train }: { train: IrelandTrain }) {
  const { live } = train;
  const where = lastLocationText(live.lastLocation);
  switch (live.state) {
    case 'running':
      return (
        <Group gap="xs" data-live-state="running">
          {live.lateMinutes !== null && <DelayBadge delayMinutes={live.lateMinutes} />}
          {where && <Text size="sm">{where}</Text>}
        </Group>
      );
    case 'arrived':
      return (
        <Group gap="xs" data-live-state="arrived">
          <Text size="sm">Arrived at {train.destination}</Text>
          {live.lateMinutes !== null && <DelayBadge delayMinutes={live.lateMinutes} />}
        </Group>
      );
    case 'notSeenRecently':
      return (
        <Text size="sm" c="dimmed" data-live-state="notSeenRecently">
          We last saw this train at {formatTime(live.observedAt)}.
        </Text>
      );
    default:
      return (
        <Text size="sm" c="dimmed" data-live-state="noReport">
          No live report yet.
        </Text>
      );
  }
}

/** The stations whose boards showed the train, as service rows: the time
 * there, the station (linked when it is in the catalogue) and the
 * timetabled time when it differs. */
function CallingPoints({ train, slug }: { train: IrelandTrain; slug: string }) {
  const rows = trainCallRows(train, slug);
  if (rows.length === 0) {
    return <ServiceListNotice>No calling points yet.</ServiceListNotice>;
  }
  return (
    <ServiceRowList aria-label="Calling points">
      {rows.map((row) => {
        const details = [row.arrivalOnly ? 'Arrives' : null, row.scheduled ? `Timetabled ${row.scheduled}` : null]
          .filter(Boolean)
          .join(' · ');
        const cells = (
          <>
            <span className={classes.time}>
              {row.time ?? (
                <>
                  <span aria-hidden="true">–</span>
                  <VisuallyHidden>No time</VisuallyHidden>
                </>
              )}
            </span>{' '}
            <span className={classes.dest}>{row.name}</span>{' '}
            {details && (
              <>
                <VisuallyHidden>. </VisuallyHidden>
                <span className={classes.details}>{details}</span>
              </>
            )}
          </>
        );
        return (
          <li key={row.key} data-station-code={row.key}>
            {row.href ? (
              <Link href={row.href} className={classes.row} data-details={details ? true : undefined}>
                {cells}
              </Link>
            ) : (
              <div className={classes.row} data-details={details ? true : undefined}>
                {cells}
              </div>
            )}
          </li>
        );
      })}
    </ServiceRowList>
  );
}

/** The board the visitor came from (`?from=`), when it is one the train
 * was seen at: the station "Track this train" says they board at. */
function fromStation(train: IrelandTrain, raw: string | string[] | undefined): string | null {
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase() ?? '';
  if (!IRELAND_STATION_CODE.test(code)) return null;
  return train.calls.some((call) => call.stationCode === code) ? code : null;
}

/** The visitor's own tracking of this train, if any: the owner controls
 * replace "Track this train" (as on a GB train's page). An anonymous
 * visitor, or a failed check, gets the plain page. */
async function myTracking(code: string, date: string): Promise<TrackedTrainListItem | null> {
  const mine = await getMyTrackedTrains().catch(() => null);
  return mine?.find((item) => item.irishTrain?.trainCode === code && item.irishTrain.serviceDate === date) ?? null;
}

/** `/island-of-ireland/[network]/trains/[train]/[date]`: one Iarnród
 * Éireann train, from the departure boards we poll
 * (docs/superpowers/specs/2026-11-05-irish-rail-train-tracking-design.md
 * §9). A train no board has shown is not found: we don't make up a page
 * for a train we haven't seen. A train running today or yesterday can be
 * tracked from here (2b). */
export default async function IrelandTrainPage({ params, searchParams }: PageProps) {
  const { network, train: segment, date } = await params;
  const { info, code } = parse(network, segment, date);
  const [train, match] = await Promise.all([loadTrain(code, date), myTracking(code, date)]);
  if (train === null) notFound();
  if (train === 'failed') {
    return (
      <Stack p="lg" gap="md">
        <Title order={1}>Train {code}</Title>
        <Text c="dimmed">{describeFailure('load', 'this train')}</Text>
        <TextLink href={irelandNetworkHref(info.slug)}>{info.name}</TextLink>
      </Stack>
    );
  }
  const from = fromStation(train, (await searchParams)?.from);
  const trackable = isTrackableIrishDate(train.serviceDate);
  return (
    <Stack p="lg" gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={1}>{irelandTrainName(train)}</Title>
          <Text size="sm" c="dimmed">
            {irelandTrainIdentifiers(train)}
          </Text>
          <TextLink href={irelandNetworkHref(info.slug)}>{info.name}</TextLink>
        </Stack>
        <Group gap="sm">
          {match ? (
            <TrackedTrainOwnerControls train={match} afterDelete="refresh" />
          ) : (
            trackable && (
              <TrackThisTrainButton
                irish={{
                  trainCode: train.trainCode,
                  serviceDate: train.serviceDate,
                  ...(from ? { fromStation: from } : {}),
                }}
                variant="light"
              />
            )
          )}
          <ShareButton />
        </Group>
      </Group>

      <LiveState train={train} />

      <Stack gap="sm">
        <SectionTitle>Calling points</SectionTitle>
        <CallingPoints train={train} slug={info.slug} />
        <Text size="xs" c="dimmed">
          Stations from live departure boards, which show trains due in the next 90 minutes.
        </Text>
      </Stack>

      <Group gap={4}>
        <LastUpdated timestamp={train.lastSeenAt} />
        <Text size="xs" c="dimmed">
          · We check the boards every 5 minutes · Local times
        </Text>
      </Group>

      <IrelandAttributionNote credits={[info.network, 'live']} />
    </Stack>
  );
}
