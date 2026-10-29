import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createReadOnlyClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function assertAdmin(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) {
    throw new Error(`Could not verify the Supabase session: ${claimsError.message}`);
  }

  const userId = claims?.claims?.sub;
  if (!userId) {
    redirect("/register?mode=login");
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    throw new Error(`Could not verify admin access: ${adminError.message}`);
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return userId;
}

export async function requireAdminClient() {
  const config = getSupabaseConfig();
  if (!config.configured) {
    redirect("/register?error=configuration");
  }

  const supabase = await createReadOnlyClient();
  await assertAdmin(supabase);
  return supabase;
}
