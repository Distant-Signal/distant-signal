'use client';

import { useEffect } from 'react';
import { installBuildHeader } from '@/lib/buildHeader';

/** Side-effect-only Client Component (renders nothing), mounted once in
 * RootLayout: makes every `/api/*` call carry the page's build id
 * (`lib/buildHeader.ts`), so the proxy can tell which builds are still
 * open in browsers. */
export function BuildHeader() {
  useEffect(() => installBuildHeader(), []);
  return null;
}
