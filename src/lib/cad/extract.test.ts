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

describe("curved and filled geometry", () => {
  it("bows a polyline bulge into an arc", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
CURB
90
2
70
0
10
0.0
20
0.0
42
1.0
10
2.0
20
0.0
0
ENDSEC
0
EOF
`);
    const curve = extract.geometry.find((entity) => entity.kind === "polyline");
    assert.ok(curve && curve.kind === "polyline");
    assert.ok(curve.points.length > 4);
    const low = Math.min(...curve.points.map((point) => point.y));
    assert.ok(low < -0.9);
  });

  it("draws an ellipse around its major axis", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
ELLIPSE
8
SITE
10
0.0
20
0.0
11
4.0
21
0.0
40
0.5
41
0.0
42
6.283185
0
ENDSEC
0
EOF
`);
    const ellipse = extract.geometry.find((entity) => entity.kind === "polyline");
    assert.ok(ellipse && ellipse.kind === "polyline" && ellipse.closed);
    const bounds = geometryBounds(extract.geometry);
    assert.ok(bounds);
    assert.ok(Math.abs(bounds.minX + 4) < 0.05);
    assert.ok(Math.abs(bounds.maxX - 4) < 0.05);
    assert.ok(Math.abs(bounds.minY + 2) < 0.05);
    assert.ok(Math.abs(bounds.maxY - 2) < 0.05);
  });

  it("fills a solid in drawing order", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
SOLID
8
POCHE
10
0.0
20
0.0
11
2.0
21
0.0
12
0.0
22
1.0
13
2.0
23
1.0
0
ENDSEC
0
EOF
`);
    const solid = extract.geometry.find((entity) => entity.kind === "polyline");
    assert.ok(solid && solid.kind === "polyline" && solid.fill && solid.closed);
    assert.deepEqual(
      solid.points.map((point) => [point.x, point.y]),
      [
        [0, 0],
        [2, 0],
        [2, 1],
        [0, 1],
      ],
    );
  });

  it("keeps a hatch boundary and fills a solid hatch", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
HATCH
8
SLAB
10
0.0
20
0.0
70
1
91
1
92
7
72
0
73
1
93
4
10
0.0
20
0.0
10
6.0
20
0.0
10
6.0
20
3.0
10
0.0
20
3.0
0
ENDSEC
0
EOF
`);
    const slab = extract.geometry.find((entity) => entity.kind === "polyline");
    assert.ok(slab && slab.kind === "polyline" && slab.fill && slab.closed);
    assert.equal(slab.points.length, 4);
    assert.equal(slab.layer, "SLAB");
  });
});

describe("dimension blocks, layers, and splines", () => {
  it("keeps a dimension block in world coordinates", () => {
    const extract = fromText(`
0
SECTION
2
BLOCKS
0
BLOCK
2
*D1
10
0.0
20
0.0
0
LINE
8
DIM
10
10.0
20
10.0
11
30.0
21
10.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
DIMENSION
8
DIM
2
*D1
10
500.0
20
500.0
11
0.0
21
0.0
1
2400
0
ENDSEC
0
EOF
`);
    const line = extract.geometry.find((entity) => entity.kind === "line");
    assert.ok(line && line.kind === "line");
    assert.ok(Math.abs(line.a.x - 10) < 0.01);
    assert.ok(Math.abs(line.a.y - 10) < 0.01);
    assert.ok(Math.abs(line.b.x - 30) < 0.01);
    assert.equal(
      extract.geometry.some((entity) => entity.kind === "text" && entity.value === "2400"),
      false,
    );
    assert.ok(extract.strings.includes("2400"));
  });

  it("places dimension text when the block is missing", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
DIMENSION
2
*D9
10
5.0
20
5.0
11
12.0
21
8.0
1
900
0
ENDSEC
0
EOF
`);
    const label = extract.geometry.find((entity) => entity.kind === "text");
    assert.ok(label && label.kind === "text");
    assert.equal(label.value, "900");
    assert.ok(Math.abs(label.p.x - 12) < 0.01);
    assert.ok(Math.abs(label.p.y - 8) < 0.01);
  });

  it("paints layer colors and lets an entity override them", () => {
    const extract = fromText(`
0
SECTION
2
TABLES
0
LAYER
2
WALLS
62
1
370
50
0
LAYER
2
PAPER
62
7
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
WALLS
10
0.0
20
0.0
11
4.0
21
0.0
0
LINE
8
WALLS
62
3
10
0.0
20
1.0
11
4.0
21
1.0
0
LINE
8
PAPER
10
0.0
20
2.0
11
4.0
21
2.0
0
ENDSEC
0
EOF
`);
    const [red, green, paper] = extract.geometry.filter((entity) => entity.kind === "line");
    assert.ok(red && red.kind === "line");
    assert.equal(red.color, "#ff0000");
    assert.ok(red.weight !== undefined && Math.abs(red.weight - 50 / 30) < 0.01);
    assert.ok(green && green.kind === "line");
    assert.equal(green.color, "#00ff00");
    assert.ok(paper && paper.kind === "line");
    assert.equal(paper.color, undefined);
  });

  it("evaluates a quadratic spline instead of its control polygon", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
SPLINE
71
2
40
0.0
40
0.0
40
0.0
40
1.0
40
1.0
40
1.0
10
0.0
20
0.0
10
1.0
20
2.0
10
2.0
20
0.0
0
ENDSEC
0
EOF
`);
    const curve = extract.geometry.find((entity) => entity.kind === "polyline");
    assert.ok(curve && curve.kind === "polyline");
    assert.ok(curve.points.length > 3);
    const high = Math.max(...curve.points.map((point) => point.y));
    assert.ok(high < 1.2);
    const mid = curve.points.reduce((best, point) =>
      Math.hypot(point.x - 1, point.y - 1) < Math.hypot(best.x - 1, best.y - 1) ? point : best,
    );
    assert.ok(Math.hypot(mid.x - 1, mid.y - 1) < 0.08);
  });
});

describe("sheet graphics", () => {
  it("dashes a hidden line and keeps a leader", () => {
    const extract = fromText(`
0
SECTION
2
TABLES
0
LTYPE
2
HIDDEN
49
0.5
49
-0.25
0
LAYER
2
WALL
6
HIDDEN
0
ENDSEC
0
SECTION
2
ENTITIES
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
LEADER
8
NOTE
10
0.0
20
2.0
10
4.0
20
4.0
10
8.0
20
4.0
0
ENDSEC
0
EOF
`);
    const line = extract.geometry.find((entity) => entity.kind === "line");
    assert.ok(line && line.kind === "line");
    assert.deepEqual(line.dash, [0.5, -0.25]);
    const leader = extract.geometry.find((entity) => entity.kind === "polyline");
    assert.ok(leader && leader.kind === "polyline");
    assert.equal(leader.points.length, 3);
    assert.equal(leader.closed, false);
  });

  it("centers rotated text on its alignment point", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
TEXT
8
ROOM
10
0.0
20
0.0
11
5.0
21
6.0
40
2.0
50
90.0
72
1
1
Kitchen
0
ENDSEC
0
EOF
`);
    const label = extract.geometry.find((entity) => entity.kind === "text");
    assert.ok(label && label.kind === "text");
    assert.equal(label.value, "Kitchen");
    assert.ok(Math.abs(label.p.x - 5) < 0.01);
    assert.ok(Math.abs(label.p.y - 6) < 0.01);
    assert.equal(label.align, "center");
    assert.ok(label.rotation !== undefined && Math.abs(label.rotation - 90) < 0.01);
  });

  it("marks a pattern hatch with its angle", () => {
    const extract = fromText(`
0
SECTION
2
ENTITIES
0
HATCH
8
EARTH
2
ANSI31
52
45.0
70
0
91
1
92
7
72
0
73
1
93
4
10
0.0
20
0.0
10
4.0
20
0.0
10
4.0
20
2.0
10
0.0
20
2.0
0
ENDSEC
0
EOF
`);
    const hatch = extract.geometry.find((entity) => entity.kind === "polyline");
    assert.ok(hatch && hatch.kind === "polyline");
    assert.equal(hatch.fill, undefined);
    assert.equal(hatch.pattern, 45);
  });
});

describe("sheet style sample", () => {
  it("contains a dashed beam, a hatched slab, and a leader", () => {
    const bytes = readFileSync("public/samples/sheet-styles.dxf");
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const extract = extractDrawing("sheet-styles.dxf", copy);
    const beam = extract.geometry.find((entity) => entity.kind === "line" && entity.layer === "BEAM");
    assert.ok(beam && beam.kind === "line" && beam.dash && beam.dash.length >= 2);
    const slab = extract.geometry.find((entity) => entity.kind === "polyline" && entity.pattern !== undefined);
    assert.ok(slab && slab.kind === "polyline");
    const leader = extract.geometry.find(
      (entity) => entity.kind === "polyline" && entity.layer === "NOTE" && !entity.closed,
    );
    assert.ok(leader && leader.kind === "polyline" && leader.points.length >= 3);
    assert.ok(extract.strings.includes("Hidden beam"));
  });
});

describe("paper sheet", () => {
  it("fits the sheet and the model window inside each viewport", () => {
    const extract = fromText(`0
SECTION
2
ENTITIES
0
LINE
8
WALL
10
0.0
20
0.0
11
1000.0
21
0.0
0
LINE
8
BORDER
67
1
10
0.0
20
0.0
11
100.0
21
0.0
0
VIEWPORT
67
1
10
50.0
20
25.0
40
80.0
41
40.0
12
500.0
22
0.0
45
100.0
68
1
69
2
0
ENDSEC
0
EOF
`);
    const wall = extract.geometry.find((entity) => entity.kind === "line" && entity.layer === "WALL");
    const border = extract.geometry.find((entity) => entity.kind === "line" && entity.layer === "BORDER");
    assert.ok(wall && wall.kind === "line");
    assert.ok(border && border.kind === "line");
    assert.ok(Math.abs(wall.a.x - 10) < 0.01);
    assert.ok(Math.abs(wall.b.x - 90) < 0.01);
    assert.ok(Math.abs(wall.a.y - 25) < 0.01);
    const bounds = geometryBounds(extract.geometry);
    assert.ok(bounds);
    assert.ok(bounds.maxX - bounds.minX < 200);
  });
});

describe("paper layouts", () => {
  it("keeps each paper layout as its own sheet", () => {
    const extract = fromText(`0
SECTION
2
BLOCKS
0
BLOCK
2
*Paper_Space0
70
0
10
0.0
20
0.0
30
0.0
3
*Paper_Space0
1

0
LINE
8
OTHER
10
0.0
20
0.0
11
40.0
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
LINE
8
BORDER
67
1
10
0.0
20
0.0
11
100.0
21
0.0
0
VIEWPORT
67
1
10
50.0
20
25.0
40
80.0
41
40.0
12
0.0
22
0.0
45
100.0
68
1
69
2
0
ENDSEC
0
EOF
`);
    assert.equal(extract.sheets.length, 2);
    assert.equal(extract.sheets[0].name, "Sheet 1");
    assert.ok(extract.sheets[0].geometry.some((entity) => entity.kind === "line" && entity.layer === "BORDER"));
    assert.ok(extract.sheets[1].geometry.some((entity) => entity.kind === "line" && entity.layer === "OTHER"));
    assert.ok(!extract.sheets[0].geometry.some((entity) => entity.kind === "line" && entity.layer === "OTHER"));
  });
});

describe("mtext height", () => {
  it("keeps the character height when an embedded object repeats group 40", () => {
    const extract = fromText(`0
SECTION
2
ENTITIES
0
MTEXT
8
Text
10
10.0
20
10.0
40
2.5
41
140.0
1
Note about the roof
101
Embedded Object
40
140.0
41
0.0
0
ENDSEC
0
EOF
`);
    const note = extract.geometry.find((entity) => entity.kind === "text");
    assert.ok(note && note.kind === "text");
    assert.equal(note.height, 2.5);
  });
});

describe("mtext columns", () => {
  it("keeps paragraph breaks and the column width", () => {
    const extract = fromText(`0
SECTION
2
ENTITIES
0
MTEXT
8
Text
10
10.0
20
20.0
40
2.0
41
40.0
3
First part of the note
1
\\PSecond part that stays
0
ENDSEC
0
EOF
`);
    const note = extract.geometry.find((entity) => entity.kind === "text");
    assert.ok(note && note.kind === "text");
    assert.equal(note.width, 40);
    assert.equal(note.value, "First part of the note\nSecond part that stays");
    const centered = fromText(`0
SECTION
2
ENTITIES
0
MTEXT
8
Text
10
1
20
1
40
2.5
41
30
1
\\pxqc;Add client info here
0
ENDSEC
0
EOF
`);
    const client = centered.geometry.find((entity) => entity.kind === "text");
    assert.ok(client && client.kind === "text");
    assert.equal(client.value, "Add client info here");
    assert.ok(extract.strings.some((line) => line.includes("First part of the note Second part")));
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
