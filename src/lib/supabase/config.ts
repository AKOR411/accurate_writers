export type SupabaseConfig =
  | { configured: true; url: string; anonKey: string }
  | { configured: false; message: string };

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      configured: false,
      message:
        "Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local, then restart the app.",
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      configured: false,
      message: "SUPABASE_URL must be a valid project URL.",
    };
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    return {
      configured: false,
      message: "SUPABASE_URL must use HTTPS.",
    };
  }

  return { configured: true, url, anonKey };
}
