/**
 * Helper to fetch required environment variables.
 * Throws an error if the variable is not defined.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

/**
 * Centralized environment variable access object.
 * Using functions ensures values are fetched at runtime (useful for SSR/Edge).
 */
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: () => getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () => getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  GROQ_API_KEY: () => process.env.GROQ_API_KEY,
};
