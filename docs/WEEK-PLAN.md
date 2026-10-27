# Week of 26 Oct – 1 Nov 2026 (Africa/Johannesburg)

Current week. Replace this file when the next week starts. Product rules stay in [`BLG-HANDOFF.md`](BLG-HANDOFF.md).

## End goal

Plancheck is the pre-submission audit principals and architects run before they lodge a council set.

A person drops a council PDF. Plancheck reads the drawing and returns a SANS 10400 pass/fail checklist: what is wrong, what to change, and by how much when numbers exist. They download a printable `.txt` checklist and an annotated PDF with notes in empty paper, not on the plan.

Finding first. Fixing is the job — Luqmaan Sayed does the drawing work. Plancheck is not a stamp, not municipal approval, and not a CAD editor. It does not rewrite the drawing.

Done, for the product, means the Marine Drive and Hartley ground-truth audits stay true, and a real vector council PDF produces the same kind of specific, numeric fails a principal can act on. Raster scans and pane-by-pane geometry from CAD are later.

## This week

Three items, in order.

### 1. Land measured XA fenestration — done

Merged [PR #22](https://github.com/vedalkenDev/Plancheck/pull/22) to `main` at 16:24 SAST (Africa/Johannesburg) on 26 Oct 2026.

When the window schedule prints overall sizes, XA 4.4.4 measures glazed area ÷ nett floor per storey. Marine Drive with no sizes keeps 16.9% / 17.1% and the 7.05 m² / 7.71 m² cuts, and warns that those figures came from the notes.

### 2. Write where the note-sniffers lie — done

Ran Marine Drive and Hartley as plotted PDFs (`marine-drive.pdf`, `hartley-test2.pdf`) plus the DXF fixtures and the notes PDF. PDF and DXF rows matched. Findings are in **Sniffer log**.

### 3. Make one more check real — done

Picked **Part M**, not Part N. Marine Drive already prints `170mm riser 250mm going`; Hartley only prints `Stairs`. Part N still passes Marine Drive on the phrase “unit sizes drawn”, so tightening it this week would fight the ground truth.

The engine now reads riser and going in millimetres (≤200 mm riser, ≥250 mm going). Marine Drive passes `170 mm riser, 250 mm going`. Hartley still fails `Stair dims missing`, with an adjust that names the missing millimetres. A 220 mm riser fails with a millimetre cut. Site area and lighting watts no longer count as stair dims.

## Out of scope this week

- Scanned raster PDFs
- Measuring glazing from anonymous wall paths or CAD pane geometry
- Rewriting the drawing
- Cadcraft, PostHog, DWG/DXF in the UI
- Naming the SANS clause on every row (closed PR #13)

## Sniffer log

Taken after item 1, before item 3, from the plotted PDFs. Same rows on the DXF fixtures.

How to read the **kind** column: **numbers** means the engine parsed a value; **sniff** means it only looked for a word or phrase.

### 69 Marine Drive (PDF sheet)

| Check | Result | Kind | What it actually did |
|---|---|---|---|
| occupancy | pass H4 dwelling | numbers | Class from the title note |
| address | pass 69 Marine Drive | numbers | Street parse |
| titleblocks | pass | sniff | One “proposed…” title |
| xa-fenestration | fail 16.9% / 17.1% | numbers (notes) | Titleblock %; no schedule sizes to measure |
| window-schedule | pass W1–W19 | sniff | Phrase “unit sizes drawn”, not pane elevations |
| part-r | pass | sniff | `soakpit` / `stormwater` |
| part-m | pass | sniff → **now numbers** | Was: `stair` plus any mm on the sheet. Sheet has `170mm riser 250mm going` |
| part-o | pass | sniff | `lighting` / `W/m` |
| parking | pass 6 / 6 | numbers | Nearby digits |
| coverage | pass | sniff | Nearby “coverage” text |
| site-area | pass 3667 m2 | numbers | Nearby digits |
| part-d | fail | sniff | Pool without 1.2 m / 100 mm / self-closing |
| signatures | fail Blank | sniff | `signature` + `blank` |
| eng-packs | fail To attach | sniff | `engineer` + `attach` |

### 130 Hartley Road (PDF sheet)

| Check | Result | Kind | What it actually did |
|---|---|---|---|
| occupancy | pass G1 medical offices | numbers | Class from the title note |
| address | fail 130 vs 132 | numbers | Two house numbers |
| titleblocks | fail | sniff | More than one project title |
| xa-fenestration | fail % missing | sniff | `XA 4.4.4 fenestration` with no storey % |
| window-schedule | pass Present | sniff | The words “Window schedule” |
| part-k | pass | sniff | Boundary wall |
| part-o | pass | sniff | Lighting |
| parking | pass 9 vs 7 | numbers | Nearby digits |
| coverage | pass | sniff | Nearby “coverage” text |
| part-r | fail | sniff | No soakpit / stormwater |
| part-m | fail Stair dims missing | sniff → **now numbers** | Was: word `Stairs` and no mm. Still fail, but now because riser and going are absent |
| part-t | skip → **now fail** | sniff | G1 medical offices with no fire / escape notes. Was skip-if-absent (never a fail). H4 dwellings still skip |
| signatures | fail Blank | sniff | Signature field, no name |
| eng-packs | fail To attach | sniff | `engineer` + `attach` |

### After this week: Part N pane elevations

When the schedule prints overall millimetre sizes, Part N now requires pane elevations too (`pane` / `fixed` / `openable` / `casement`). Overall without panes fails with a type-named adjust. Marine Drive still passes `W1–W19 with unit sizes drawn` (no parseable mm). Hartley still passes `Present` (the words “Window schedule”). A notes fixture with overall + panes passes the measured elevations.

Next real check: **Part R** if a sheet starts printing soakpit sizes.
