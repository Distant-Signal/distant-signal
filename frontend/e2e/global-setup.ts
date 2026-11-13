// Fails the run, instead of letting specs `test.skip()` themselves, when CI
// is missing a fixture variable. The specs skip on a missing E2E_* variable
// so a developer without the seeded stack can still run the rest; in CI a
// skip means a typo or a dropped line in the workflow's env block silently
// removed coverage and the job stayed green.
//
// Keep in step with the `E2E_*` ids in .github/workflows/ci.yml's
// frontend-e2e `env:` block (the variables the specs skip on).
export const REQUIRED_FIXTURES = [
  'E2E_REAL_LINE_ID',
  'E2E_CUSTOM_LINE_ID',
  'E2E_REAL_STATION_CRS',
  'E2E_REAL_INCIDENT_ID',
  'E2E_TRAIN_UID',
  'E2E_TRAIN_DATE',
  'E2E_TRACKING_ID',
  'E2E_GROUP_ID',
  'E2E_GROUP_INVITE_TOKEN',
  'E2E_SESSION_COOKIE',
];

export default function globalSetup(): void {
  if (!process.env.CI) return;
  const missing = REQUIRED_FIXTURES.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `CI is missing required e2e fixture variables: ${missing.join(', ')}. ` +
        'Set them in the frontend-e2e job env (specs would otherwise skip silently).',
    );
  }
}
