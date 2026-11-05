import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extractDrawing } from "../src/lib/cad/extract";
import { marineDriveRasterPdf } from "../src/lib/pdf/fixture";
import { plotDrawingPdf } from "../src/lib/pdf/plot";

function load(path: string, name: string) {
  const bytes = readFileSync(path);
  return extractDrawing(
    name,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

async function plot(src: string, dest: string, name: string) {
  if (!existsSync(src)) {
    console.warn("skip missing", src);
    return;
  }
  writeFileSync(dest, await plotDrawingPdf(load(src, name)));
  console.log("wrote", dest);
}

async function main() {
  await plot("fixtures/cad/marine-drive.dxf", "public/samples/marine-drive.pdf", "marine-drive.dxf");
  await plot("fixtures/cad/hartley-test2.dxf", "public/samples/hartley-test2.pdf", "hartley-test2.dxf");
  await plot("/tmp/drawings/woodshed-plan.dxf", "public/samples/woodshed-plan.pdf", "woodshed-plan.dxf");
  writeFileSync("public/samples/marine-drive-notes-raster.pdf", await marineDriveRasterPdf());
  console.log("wrote public/samples/marine-drive-notes-raster.pdf");
}

void main();
