# BLG-2026 Plancheck handoff

Durable context from Knight (BLG Grok) via Muhammed, plus the Marine Drive and Hartley ground-truth audits. Future runs should read this before changing the engine or UX.

This is a **pre-submission audit**. It is not a stamp, not municipal approval, and not a competent-person substitute.

## Product

- **Users:** non-technical principals and architects.
- **Offer:** finding first; fixing is the job. Luqmaan Sayed on the work.
- **Path:** [vedalken.dev/plancheck](https://vedalken.dev/plancheck)
- **Repo:** [github.com/vedalkenDev/Plancheck](https://github.com/vedalkenDev/Plancheck) is the live line. Dark dashboard is the UI: Plancheck left, Vedalken Dev right, drawing on the left third, analysis on the rest. Do not restore the cream paper canvas.
- **Flow:** upload a council PDF → pass/fail checklist + annotated PDF. Notes pack into empty paper around the drawing.
- **Downloads:** checklist as `.txt` (printable). Never ship Markdown as the user-facing checklist. Annotated output is the same PDF with fixtures in empty space on the sheet.
- **Copy:** say “drawing” and “checklist”. Do not say DXF, MTEXT, or layer names in the UI.
- **Occupancy:** read from the drawing. Never hardcode one class for every upload. H4 is a dwelling; G1 can be medical offices; A20 is a *regulation*, not an occupancy class.

## Proven engine pipeline

```
PDF (vector plot from CAD)
    → reconstruct printed notes + wall paths
    → occupy the plan as a block, pack notes into empty paper
    → route via Council of Six SANS index (part letter → PDF → headings; do not ingest the whole pack)
    → PASSED / FAILED(+ADJUST) + on-sheet note cards (overflow page only if a pocket will not fit)
```

Annotation layers (preview, not UI jargon): `COUNCIL_CHECK`, `WIN_SCHED`, `COUNCIL_FIXES`, `WINDOW_DIMS`.

**This browser MVP** imports PDF and exports PDF. CAD parsers remain as fixtures for tests. Do not put failed-check cards on the floor plan.

## SANS drawing rules (index, not the book)

- **A7:** show fixed and openable windows in enough detail for the local authority.
- **Part N:** glass by pane area and support → dimensioned window type elevations (overall + panes) in free space on the sheet.
- **XA 4.4.4:** ≤15% fenestration to nett floor **per storey** is the deemed-to-satisfy path. **>15% → SANS 204.** Never “under 20% so XA not required.”
- **Part D (pools):** enclosure ≥1.2 m high, openings ≤100 mm, self-closing / self-latching gate.
- **Form 1 / A19:** owner and competent-person signatures; engineering packs attached when called for.
- **Address / titleblocks:** one address, one project title across the set.

Do not dump full SANS book text into the repo or the UI.

## Checklist schema

```ts
passed[]: { id, part, check, detail }
failed[]: { id, part, check, detail, adjust } // specific + numeric when possible
files: checklist_txt + annotated_pdf // notes in empty paper on the sheet
```

FAILED rows must say **what to change** and **by how much** when numbers exist.

## Ground-truth samples

Correct the engine if it diverges from these.

### 1. Marine Drive — Erf 672 Bluff, House Khan

- Occupancy **H4 dwelling** additions (not A20).
- On face **PASS:** coverage, parking, stairs, soakpit, lighting. Window schedule W1–W19 with unit sizes drawn.
- **FAIL:**
  - L/G fenestration **16.9%**, Ground **17.1%** (both >15%) → apply SANS 204 **or** cut about **7.05 m²** (L/G) and **7.71 m²** (Ground) of glazing to get to 15%.
  - Part D pool enclosure ≥1.2 m / 100 mm / self-closing gate.
  - Engineering packs to attach.
  - Owner signature blank.

### 2. 130 Hartley Road, Sydenham

- Occupancy **G1 medical offices** conversion (not H4).
- **FAIL:** 130 vs 132 address; XA % missing; Part R soakpit; Part M stair dims; signatures / eng packs; stray titleblocks.

## What still needs a CAD worker

| Capability | Browser now | Later |
|---|---|---|
| Read council PDF notes + wall paths | Yes | Scanned sheets |
| Pack failed checks into empty paper | Yes | — |
| Annotated **PDF** out | Yes | — |
| Measure glazed area from window schedule sizes | Yes | Pane-by-pane CAD / anonymous PDF strokes |
| True window pane dimensions from geometry | Not yet | Better with CAD geometry |
