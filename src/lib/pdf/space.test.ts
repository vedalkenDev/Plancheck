import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { GeomEntity } from "@/lib/cad/extract";
import { geometryBounds } from "@/lib/cad/preview";
import { extractPdf } from "./extract";
import { cardsFromAudit, layoutNoteCards, rectsOverlap, type NoteCard } from "./space";

const page = { width: 1000, height: 700 };

const card: NoteCard = {
  id: "verdict",
  title: "PLANCHECK",
  body: "Close, not council-ready.",
  minW: 210,
  minH: 64,
};

function failCards(count: number): NoteCard[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `fail-${index}`,
    title: `SANS A  Check ${index}`,
    body: "Add the missing note on this sheet.",
    minW: 200,
    minH: 80,
  }));
}

function occupiedLeft(): GeomEntity[] {
  return [
    {
      kind: "polyline",
      closed: true,
      points: [
        { x: 20, y: 20 },
        { x: 480, y: 20 },
        { x: 480, y: 680 },
        { x: 20, y: 680 },
      ],
    },
  ];
}

describe("layoutNoteCards", () => {
  it("parks a card on an empty page, inset from the edge", () => {
    const { placed, leftover } = layoutNoteCards([], page, [card]);
    assert.equal(leftover.length, 0);
    assert.equal(placed.length, 1);
    const rect = placed[0].rect;
    assert.ok(rect.x >= 12);
    assert.ok(rect.y >= 12);
    assert.ok(rect.x + rect.w <= page.width - 12);
    assert.ok(rect.y + rect.h <= page.height - 12);
    assert.ok(rect.y + rect.h > page.height * 0.7);
  });

  it("uses the empty half when the plan occupies the left", () => {
    const { placed, leftover } = layoutNoteCards(occupiedLeft(), page, [card, ...failCards(2)]);
    assert.equal(leftover.length, 0);
    assert.ok(placed.length >= 3);
    for (const item of placed) {
      assert.ok(item.rect.x >= 480, `card ${item.card.id} overlaps the plan at x=${item.rect.x}`);
      assert.equal(
        rectsOverlap(item.rect, { x: 20, y: 20, w: 460, h: 660 }, 4),
        false,
      );
    }
  });

  it("does not cover printed notes next to the plan", () => {
    const geometry: GeomEntity[] = [
      ...occupiedLeft(),
      {
        kind: "text",
        p: { x: 520, y: 640 },
        height: 12,
        width: 220,
        value: "Window schedule W1-W19",
      },
    ];
    const { placed } = layoutNoteCards(geometry, page, [card]);
    assert.ok(placed.length >= 1);
    for (const item of placed) {
      assert.equal(
        rectsOverlap(item.rect, { x: 520, y: 628, w: 220, h: 24 }, 6),
        false,
      );
    }
  });

  it("returns leftover cards when the sheet has no pocket large enough", () => {
    const wall: GeomEntity[] = [
      {
        kind: "polyline",
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 700 },
          { x: 0, y: 700 },
        ],
      },
    ];
    const { placed, leftover } = layoutNoteCards(wall, page, failCards(4));
    assert.equal(placed.length, 0);
    assert.equal(leftover.length, 4);
  });

  it("fits villa notes into the empty margin, not the floor plan", async () => {
    const bytes = readFileSync("public/samples/747-villa.pdf");
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const extract = await extractPdf("747-villa.pdf", copy);
    assert.ok(extract.pageWidth);
    assert.ok(extract.pageHeight);
    const plan = geometryBounds(extract.geometry.filter((entity) => entity.kind !== "text"));
    assert.ok(plan);

    const auditCards = cardsFromAudit({
      id: "villa",
      slug: "villa",
      label: "Villa",
      fileStem: "villa",
      project: "747 Villa",
      erf: null,
      address: "",
      occupancy: "H4",
      occupancyNote: "dwelling",
      verdict: "Not council-ready.",
      passed: [],
      failed: [
        {
          id: "part-d",
          part: "D",
          check: "Pool enclosure",
          detail: "Missing",
          status: "fail",
          adjust: "Fence the pool at 1.2 m.",
        },
        {
          id: "signatures",
          part: "A19",
          check: "Signatures",
          detail: "Missing",
          status: "fail",
          adjust: "Owner and competent person to sign.",
        },
      ],
    });

    const { placed } = layoutNoteCards(
      extract.geometry,
      { width: extract.pageWidth, height: extract.pageHeight },
      auditCards,
    );
    assert.ok(placed.length >= 1);
    const occupied = {
      x: plan.minX,
      y: plan.minY,
      w: plan.maxX - plan.minX,
      h: plan.maxY - plan.minY,
    };
    for (const item of placed) {
      assert.equal(rectsOverlap(item.rect, occupied, 4), false, JSON.stringify(item.rect));
    }
  });
});
