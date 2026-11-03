import type { NextRequest } from 'next/server';
import { matchStopPointRoute, servePublicTfl } from '@/lib/tflPublicApi';

/** The public, anonymous `/StopPoint/{crs}/Disruption` route, at TfL's own
 * path (docs/public-api.md). See `lib/tflPublicApi.ts`. Only GET and HEAD
 * are exported, so Next answers every other method with 405. */
export const dynamic = 'force-dynamic';

interface Context {
  params: Promise<{ crs: string }>;
}

export async function GET(req: NextRequest, { params }: Context): Promise<Response> {
  return servePublicTfl('GET', req.headers, matchStopPointRoute((await params).crs));
}

export async function HEAD(req: NextRequest, { params }: Context): Promise<Response> {
  return servePublicTfl('HEAD', req.headers, matchStopPointRoute((await params).crs));
}
