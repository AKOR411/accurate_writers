import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/config";
import type { Database } from "./lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error) {
    throw new Error(`Could not verify the Supabase session: ${error.message}`);
  }

  if (!data?.claims) {
    return NextResponse.redirect(new URL("/register?mode=login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
