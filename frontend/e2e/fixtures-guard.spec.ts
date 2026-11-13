import { expect, test } from '@playwright/test';

// The specs skip (`test.skip`) when an `E2E_*` fixture variable is unset, so
// a developer without the seeded stack can still run the rest. In CI a skip
// means a typo or a dropped line in the frontend-e2e job's `env:` block
// silently removed coverage while the job stayed green. This fails instead.
//
// Keep in step with the `E2E_*` ids in .github/workflows/ci.yml.
const REQUIRED_FIXTURES = [
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

test('CI sets every fixture variable the specs skip on', () => {
  test.skip(!process.env.CI, 'only enforced in CI');
  const missing = REQUIRED_FIXTURES.filter((name) => !process.env[name]);
  expect(missing, 'missing from the frontend-e2e job env; specs would skip silently').toEqual([]);
});
