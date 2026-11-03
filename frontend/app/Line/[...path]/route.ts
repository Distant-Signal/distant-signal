import type { NextRequest } from 'next/server';
import { matchLineRoute, servePublicTfl } from '@/lib/tflPublicApi';

/** The public, anonymous `/Line/...` read routes, at TfL's own paths
 * (docs/public-api.md). Allowlist, caching and the no-cookie rule live in
 * `lib/tflPublicApi.ts`. Only GET and HEAD are exported, so Next answers
 * every other method with 405. */
export const dynamic = 'force-dynamic';

interface Context {
  params: Promise<{ path: string[] }>;
}

export async function GET(req: NextRequest, { params }: Context): Promise<Response> {
  return servePublicTfl('GET', req.headers, matchLineRoute((await params).path, req.nextUrl.searchParams));
}

export async function HEAD(req: NextRequest, { params }: Context): Promise<Response> {
  return servePublicTfl('HEAD', req.headers, matchLineRoute((await params).path, req.nextUrl.searchParams));
}
