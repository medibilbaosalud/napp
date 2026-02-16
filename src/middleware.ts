import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware handles authentication and route protection.
 * It ensures that users are authenticated before accessing /app routes
 * and prevents authenticated users from accessing login/signup pages.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing Supabase env vars in middleware. Expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    return response;
  }

  // Initialize Supabase client for middleware
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Check authentication status
  let isAuthed = false;
  try {
    const { data } = await supabase.auth.getUser();
    isAuthed = Boolean(data.user);
  } catch (error) {
    console.error("Supabase auth.getUser() failed in middleware.", error);
  }

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/auth/callback");

  // Redirect to login if accessing protected /app routes without auth
  if (path.startsWith("/app") && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Redirect to /app if already authenticated and trying to access auth pages
  if (isAuthRoute && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Configure routes that the middleware should run on.
 */
export const config = {
  matcher: ["/app/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"],
};
