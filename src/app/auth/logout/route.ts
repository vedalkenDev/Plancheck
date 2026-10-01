import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/auth/paths";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  if (hasSupabaseConfig()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", origin), 303);
}
