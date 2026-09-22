# BLG-2026 Plancheck handoff

Durable context from Knight (BLG Grok) via Muhammed, plus the Marine Drive and Hartley ground-truth audits. Future runs should read this before changing the engine or UX.

This is a **pre-submission audit**. It is not a stamp, not municipal approval, and not a competent-person substitute.

## Product

- **Users:** non-technical principals and architects.
- **Offer:** finding first; fixing is the job. Luqmaan Sayed on the work.
- **Path:** [vedalken.dev/plancheck](https://vedalken.dev/plancheck)
- **Repo:** [github.com/vedalkenDev/Plancheck](https://github.com/vedalkenDev/Plancheck) is the live line. The Origin paper UI was a failed trial — do not copy it.
- **UI (Luqmaan):** Dark shadcn dashboard. Header: Plancheck left, Vedalken Dev right, theme toggle. Layout: 1/3 drawing / 2/3 analysis (Passed, Not approved, What to change). This is the direction.
- **Xun:** Paper lock is withdrawn. Take notes. Do not restyle Plancheck back to paper / Newsreader / bronze offer line. Engine/SANS is not yours to change.
- **Flow:** upload a drawing (`.dwg` / `.dxf`) → pass/fail checklist + annotated drawing.
- **Downloads:** checklist as `.txt` (printable). Never ship Markdown as the user-facing checklist. Annotated output is a real drawing file with notes/schedules — never a text file renamed `.dwg`.
- **Copy:** say “drawing” and “checklist”. Do not say DXF, MTEXT, or layer names in the UI.
- **Occupancy:** read from the drawing. Never hardcode one class for every upload. H4 is a dwelling; G1 can be medical offices; A20 is a *regulation*, not an occupancy class.

## Proven engine pipeline

```
DWG → DXF (ODA File Converter, server-side when available)
    → parse (layers, text, dimensions)
    → route via Council of Six SANS index (part letter → PDF → headings; do not ingest the whole pack)
    → PASSED / FAILED(+ADJUST) + drawing annotations
```

Annotation layers (CAD, not UI jargon): `COUNCIL_CHECK`, `WIN_SCHED`, `COUNCIL_FIXES`, `WINDOW_DIMS`.

**This browser MVP** parses DXF in the client, scrapes readable strings from binary DWG, and writes an **annotated DXF**. It does **not** run ODA or ezdxf. Real DWG-in / DWG-out needs a server-side CAD worker (ODA). Until that exists, the annotated download is DXF that CAD can open.

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
files: checklist_txt + annotated_dwg // annotated_dwg = real CAD; DXF until ODA DWG write exists
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

| Capability | Browser now | Needs ODA (or equivalent) worker |
|---|---|---|
| Read DXF text + geometry | Yes | — |
| Read binary DWG titles/notes | Partial (string scrape) | Full DWG→DXF |
| ezdxf-quality layers/dims | Partial DXF | Yes |
| Annotated DXF with council layers | Yes | — |
| Annotated **DWG** out | No | Yes (ODA write) |
| True window pane dimensions from geometry | Not yet | Better with ODA + ezdxf |
