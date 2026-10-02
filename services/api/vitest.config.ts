import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'test',
      CASHFREE_APP_ID: 'test_app_id',
      CASHFREE_SECRET_KEY: 'test_secret',
      CASHFREE_ENVIRONMENT: 'SANDBOX'
    },
  },
});
