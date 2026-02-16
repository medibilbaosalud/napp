import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 * It automatically handles session persistence using Next.js cookies.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL(),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        /**
         * setAll is used to sync cookies back to the client.
         * Note: Server Components cannot set cookies directly if they've already started streaming.
         * Middleware and Route Handlers are the preferred places for setting cookies.
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies; handled in middleware/route handlers.
          }
        },
      },
    },
  );
}
