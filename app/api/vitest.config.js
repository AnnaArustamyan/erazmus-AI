import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      MOONSHOT_API_KEY: 'test-moonshot-key',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      CLIENT_ORIGIN: 'http://localhost:5173',
    },
  },
});
