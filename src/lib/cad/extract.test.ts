import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { extractDrawing } from "./extract";
import { geometryBounds } from "./preview";

function fromText(dxf: string) {
  const bytes = Buffer.from(dxf);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return extractDrawing("plan.dxf", copy);
}

describe("block inserts", () => {
  const dxf = `
0
SECTION
2
BLOCKS
0
BLOCK
2
CHAIR
10
0.0
20
0.0
0
LINE
8
FURN
10
0.0
20
0.0
11
2.0
21
0.0
0
ENDBLK
0
BLOCK
2
ROOM
10
0.0
20
0.0
0
INSERT
2
CHAIR
10
5.0
20
5.0
41
1.0
42
1.0
0
TEXT
8
NOTE
10
1.0
20
1.0
40
1.0
1
Pool
0
LINE
8
WALL
10
0.0
20
0.0
11
8.0
21
0.0
0
LINE
8
WALL
10
1.0
20
0.0
11
1.0
21
4.0
0
LINE
8
WALL
10
2.0
20
0.0
11
2.0
21
4.0
0
LINE
8
WALL
10
3.0
20
0.0
11
3.0
21
4.0
0
LINE
8
WALL
10
4.0
20
0.0
11
4.0
21
4.0
0
LINE
8
WALL
10
5.0
20
0.0
11
5.0
21
4.0
0
LINE
8
WALL
10
6.0
20
0.0
11
6.0
21
4.0
0
LINE
8
WALL
10
7.0
20
0.0
11
7.0
21
4.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
ROOM
10
100.0
20
200.0
41
10.0
42
10.0
50
0.0
0
LINE
8
STRAY
10
0.0
20
0.0
11
5000000.0
21
8000000.0
0
ENDSEC
0
EOF
`;

  const extract = fromText(dxf);

  it("draws the inserted plan at the insert point, not the block origin", () => {
    const line = extract.geometry.find((entity) => entity.kind === "line" && entity.layer === "FURN");
    assert.ok(line && line.kind === "line");
    assert.ok(Math.abs(line.a.x - 150) < 0.01);
    assert.ok(Math.abs(line.a.y - 250) < 0.01);
    assert.ok(Math.abs(line.b.x - 170) < 0.01);
    assert.ok(Math.abs(line.b.y - 250) < 0.01);
    assert.equal(
      extract.geometry.some(
        (entity) => entity.kind === "line" && entity.a.x === 0 && entity.b.x === 2,
      ),
      false,
    );
  });

  it("keeps block text on the sheet and in the notes the audit reads", () => {
    const label = extract.geometry.find((entity) => entity.kind === "text" && entity.value === "Pool");
    assert.ok(label && label.kind === "text");
    assert.ok(Math.abs(label.p.x - 110) < 0.01);
    assert.ok(Math.abs(label.p.y - 210) < 0.01);
    assert.ok(Math.abs(label.height - 10) < 0.01);
    assert.ok(extract.strings.includes("Pool"));
  });

  it("frames the inserted plan instead of a stray point", () => {
    const bounds = geometryBounds(extract.geometry);
    assert.ok(bounds);
    assert.ok(bounds.minX >= 90);
    assert.ok(bounds.maxX <= 200);
    assert.ok(bounds.minY >= 190);
    assert.ok(bounds.maxY <= 270);
  });
});

describe("rotated insert", () => {
  it("turns a horizontal line upright", () => {
    const extract = fromText(`
0
SECTION
2
BLOCKS
0
BLOCK
2
WALL
10
0.0
20
0.0
0
LINE
8
WALL
10
0.0
20
0.0
11
10.0
21
0.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
WALL
10
0.0
20
0.0
41
2.0
42
2.0
50
90.0
0
ENDSEC
0
EOF
`);
    const line = extract.geometry.find((entity) => entity.kind === "line");
    assert.ok(line && line.kind === "line");
    assert.ok(Math.abs(line.a.x) < 0.01);
    assert.ok(Math.abs(line.a.y) < 0.01);
    assert.ok(Math.abs(line.b.x) < 0.01);
    assert.ok(Math.abs(line.b.y - 20) < 0.01);
  });
});

describe("sample drawings", () => {
  it("still frames the marine drive site", () => {
    const bytes = readFileSync("public/samples/marine-drive.dxf");
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const extract = extractDrawing("marine-drive.dxf", copy);
    const bounds = geometryBounds(extract.geometry);
    assert.ok(bounds);
    assert.ok(bounds.minX >= -1);
    assert.ok(bounds.maxX <= 26000);
    assert.ok(bounds.maxX >= 18000);
    assert.ok(bounds.maxY <= 12000);
    assert.ok(bounds.maxY >= 9000);
    assert.ok(extract.strings.some((line) => /69 Marine Drive/i.test(line)));
  });
});
