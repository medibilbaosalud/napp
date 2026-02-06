export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: () => getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () => getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  GROQ_API_KEY: () => process.env.GROQ_API_KEY,
};
