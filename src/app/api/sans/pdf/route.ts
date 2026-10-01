import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

const PART = /^[A-Za-z0-9]{1,8}$/;

export async function GET(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createServerSupabase();
  const { data: claimsData } = await supabase.auth.getClaims();
  const email =
    typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null;
  if (!isAllowedEmail(email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const part = url.searchParams.get("part")?.trim() ?? "";
  const pageRaw = url.searchParams.get("page");
  if (!PART.test(part)) {
    return NextResponse.json({ error: "Unknown part" }, { status: 400 });
  }

  let page: number | null = null;
  if (pageRaw) {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: "Unknown page" }, { status: 400 });
    }
  }

  const admin = supabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Signed PDF links need the service role key on the server." },
      { status: 503 },
    );
  }

  const { data: row, error: lookupError } = await admin
    .from("parts")
    .select("storage_path")
    .eq("letter", part)
    .maybeSingle();
  if (lookupError || !row?.storage_path) {
    return NextResponse.json({ error: "Part PDF not found" }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("sans-pdfs")
    .createSignedUrl(row.storage_path, 120);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Could not sign the PDF" },
      { status: 502 },
    );
  }

  const signedUrl = page ? `${data.signedUrl}#page=${page}` : data.signedUrl;
  return NextResponse.json({ url: signedUrl });
}
