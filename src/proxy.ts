import { type NextRequest } from "next/server";
import { gateRequest } from "@/lib/auth/proxy";

export function proxy(request: NextRequest) {
  return gateRequest(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
