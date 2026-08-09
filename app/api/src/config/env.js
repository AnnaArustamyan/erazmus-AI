import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function read(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * Validates required environment variables.
 * In production, missing critical vars throw so the process does not start half-configured.
 * In development/test, warn and continue so local tooling still works.
 */
export function validateEnv() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MOONSHOT_API_KEY',
  ];

  const missing = required.filter((name) => !read(name));

  if (missing.length === 0) return;

  const message = `[env] Missing required variables: ${missing.join(', ')}`;
  if (isProduction && !isTest) {
    throw new Error(message);
  }
  console.warn(`${message}. Chat and document generation will fail until they are set.`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  clientOrigin: read('CLIENT_ORIGIN') || 'http://localhost:5173',
  supabaseUrl: read('SUPABASE_URL') || '',
  supabaseServiceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY') || '',
  moonshotApiKey: read('MOONSHOT_API_KEY') || '',
  moonshotBaseUrl: read('MOONSHOT_BASE_URL') || 'https://api.moonshot.ai/v1',
  moonshotModel: read('MOONSHOT_MODEL') || 'moonshot-v1-8k',
  requireEmailConfirmation: process.env.REQUIRE_EMAIL_CONFIRMATION === 'true',
};

export function isMoonshotConfigured() {
  return Boolean(read('MOONSHOT_API_KEY') || env.moonshotApiKey);
}

export function isSupabaseConfigured() {
  return Boolean(
    (read('SUPABASE_URL') || env.supabaseUrl) &&
      (read('SUPABASE_SERVICE_ROLE_KEY') || env.supabaseServiceRoleKey),
  );
}
