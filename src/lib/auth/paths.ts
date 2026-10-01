export function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/wasm/")
  );
}

export function safeNextPath(next: string | null | undefined, fallback = "/plancheck") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}

export function publicOrigin(request: Request, nodeEnv = process.env.NODE_ENV) {
  const url = new URL(request.url);
  if (nodeEnv === "development") {
    const host = request.headers.get("host") ?? url.host;
    return `${url.protocol}//${host}`;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return url.origin;
  }
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
