import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const FILES: Record<string, string> = {
  "libredwg-web.js": "text/javascript; charset=utf-8",
  "libredwg-web.wasm": "application/wasm",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const contentType = FILES[file];
  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = await readFile(
    path.join(process.cwd(), "node_modules/@mlightcad/libredwg-web/wasm", file),
  );
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
