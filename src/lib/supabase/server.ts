import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

async function createClientWithCookies(writable: boolean) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    throw new Error(config.message);
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (writable) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        }
      },
    },
  });
}

export async function createClient() {
  return createClientWithCookies(true);
}

export async function createReadOnlyClient() {
  return createClientWithCookies(false);
}
