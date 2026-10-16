import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, readGate } from "@/lib/auth/gate";
import { isPublicPath } from "@/lib/auth/paths";

export function gateRequest(request: NextRequest) {
  const email = readGate(request.cookies.get(GATE_COOKIE)?.value);
  const path = request.nextUrl.pathname;

  if (email && (path === "/login" || path === "/waitlist")) {
    return NextResponse.redirect(new URL("/plancheck", request.url));
  }

  if (!isPublicPath(path) && !email) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next({ request });
}
