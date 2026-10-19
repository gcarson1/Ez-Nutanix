import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Simulation tests are deterministic but CPU-heavy; on a busy machine running files in
  // parallel they can pass 5 s, so allow more time instead of failing on load.
  test: { include: ['tests/engine/**/*.test.ts'], environment: 'node', testTimeout: 20_000 },
});
