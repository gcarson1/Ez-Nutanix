import { defineConfig } from '@playwright/test';

// Smoke tests run against the built single file (npm run build first), opened from disk
// the way a customer opens an email attachment.
export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 30_000,
  reporter: 'list',
  use: { viewport: { width: 1600, height: 900 } },
});
