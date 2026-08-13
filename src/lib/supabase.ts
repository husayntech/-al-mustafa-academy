import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env\n" +
    "The server will attempt to start, but database operations will fail.\n" +
    "Get your credentials from: https://supabase.com/dashboard/project/_/settings/api"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Get a direct PostgreSQL connection URL for postgres.js.
 * Constructs from SUPABASE_URL (project reference + region).
 */
export function getPostgresConnectionString(): string {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const dbHost = process.env.SUPABASE_DB_HOST;

  if (dbHost && dbPassword) {
    return `postgres://postgres:${dbPassword}@${dbHost}:5432/postgres`;
  }

  if (projectRef && dbPassword) {
    return `postgres://postgres:${dbPassword}@${projectRef}.supabase.co:5432/postgres`;
  }

  // Fallback: try to extract from SUPABASE_URL
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/);
    if (match && dbPassword) {
      return `postgres://postgres:${dbPassword}@${match[1]}.supabase.co:5432/postgres`;
    }
  }

  return "";
}
