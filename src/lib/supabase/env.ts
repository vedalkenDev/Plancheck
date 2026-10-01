export function hasSupabaseConfig() {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

export function supabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function requireSupabaseConfig() {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) {
    throw new Error("Supabase URL and publishable key are missing");
  }
  return { url, key };
}
