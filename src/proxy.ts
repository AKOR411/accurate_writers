import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminHost } from "./lib/admin-host";
import { getSupabaseConfig } from "./lib/supabase/config";
import type { Database } from "./lib/supabase/database.types";

function getAdminRewritePath(request: NextRequest): string | null {
  const requestHost =
    request.headers.get("host") ?? request.headers.get("x-forwarded-host");
  if (!isAdminHost(requestHost ?? request.nextUrl.hostname)) {
    return null;
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/login") {
    return "/admin-login";
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/admin-login" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return null;
  }

  return pathname === "/" ? "/admin" : `/admin${pathname}`;
}

export async function proxy(request: NextRequest) {
  const adminRewritePath = getAdminRewritePath(request);
  const pathname = request.nextUrl.pathname;
  const requestHost =
    request.headers.get("host") ?? request.headers.get("x-forwarded-host");
  const isAdminPortal = isAdminHost(requestHost ?? request.nextUrl.hostname);

  if (isAdminPortal && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    isAdminPortal &&
    (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
  ) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (
    isAdminPortal &&
    (pathname === "/register" || pathname.startsWith("/register/"))
  ) {
    const query = request.nextUrl.searchParams.toString();
    return NextResponse.redirect(
      new URL(`/login${query ? `?${query}` : ""}`, request.url),
    );
  }

  const isAdminLoginPath =
    isAdminPortal && (pathname === "/login" || pathname === "/admin-login");
  if (isAdminLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/login" ? "/admin-login" : pathname;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      "x-forwarded-host",
      requestHost?.split(",")[0].trim() ?? request.nextUrl.hostname,
    );
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    adminRewritePath === "/admin" ||
    adminRewritePath?.startsWith("/admin/") === true;

  if (!isAdminRoute && pathname !== "/dashboard" && !pathname.startsWith("/dashboard/")) {
    return NextResponse.next({ request });
  }

  const config = getSupabaseConfig();
  if (!config.configured) {
    return NextResponse.next({ request });
  }

  const createResponse = () => {
    if (!adminRewritePath) {
      return NextResponse.next({ request });
    }

    const url = request.nextUrl.clone();
    url.pathname = adminRewritePath;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      "x-forwarded-host",
      requestHost?.split(",")[0].trim() ?? request.nextUrl.hostname,
    );
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  };
  let response = createResponse();
  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = createResponse();
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

  if (isAdminRoute && !data?.claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
