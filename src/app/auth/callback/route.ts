import { NextResponse, type NextRequest } from "next/server";
import { isAdminHost } from "@/lib/admin-host";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return NextResponse.redirect(
      new URL("/register?mode=login&error=configuration", request.url),
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/register?mode=login&error=confirmation", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Supabase auth callback failed:", error.message);
    return NextResponse.redirect(
      new URL("/register?mode=login&error=confirmation", request.url),
    );
  }

  if (isAdminHost(request.headers.get("host"))) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.error("Supabase confirmation session cleanup failed:", signOutError.message);
    return NextResponse.redirect(
      new URL("/register?mode=login&error=session-cleanup", request.url),
    );
  }

  return NextResponse.redirect(new URL("/register?mode=login&confirmed=1", request.url));
}
