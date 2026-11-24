import { parseBuildEpoch } from '@/lib/buildEpoch';
import { createLogger } from '@/lib/logger';

let warned: string | null = null;

/** The operator's floor from `FRONTEND_MIN_BUILD`, read per call (server
 * only). Unset or empty means the feature is off. A value that is not a
 * whole number is ignored, with one warning per distinct value. */
export function configuredMinBuild(): number | null {
  const raw = process.env.FRONTEND_MIN_BUILD?.trim() ?? '';
  if (raw === '') return null;
  const parsed = parseBuildEpoch(raw);
  if (parsed === null && warned !== raw) {
    warned = raw;
    createLogger('lib/minBuild').warn('FRONTEND_MIN_BUILD is not a whole number, ignoring it', {
      value_length: raw.length,
    });
  }
  return parsed;
}

/** Test helper: forgets the last warning. */
export function resetMinBuildWarning(): void {
  warned = null;
}
