/**
 * Reads the first non-empty env var from a list.
 * Throws a single error that includes all accepted names.
 */
export function getRequiredEnvAny(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing env var: ${names.join(" or ")}`);
}

/**
 * Centralized environment variable access object.
 * Using functions ensures values are fetched at runtime (useful for SSR/Edge).
 */
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: () =>
    getRequiredEnvAny(["NEXT_PUBLIC_SUBAPASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () =>
    getRequiredEnvAny(["NEXT_PUBLIC_SUBAPASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
  GROQ_API_KEY: () => process.env.GROQ_API_KEY,
};
