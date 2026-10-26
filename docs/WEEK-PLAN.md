# Week of 26 Oct – 1 Nov 2026 (Africa/Johannesburg)

Current week. Replace this file when the next week starts. Product rules stay in [`BLG-HANDOFF.md`](BLG-HANDOFF.md).

## End goal

Plancheck is the pre-submission audit principals and architects run before they lodge a council set.

A person drops a council PDF. Plancheck reads the drawing and returns a SANS 10400 pass/fail checklist: what is wrong, what to change, and by how much when numbers exist. They download a printable `.txt` checklist and an annotated PDF with notes in empty paper, not on the plan.

Finding first. Fixing is the job — Luqmaan Sayed does the drawing work. Plancheck is not a stamp, not municipal approval, and not a CAD editor. It does not rewrite the drawing.

Done, for the product, means the Marine Drive and Hartley ground-truth audits stay true, and a real vector council PDF produces the same kind of specific, numeric fails a principal can act on. Raster scans and pane-by-pane geometry from CAD are later.

## This week

Three items, in order. Do not start 3 until 1 is on `main` and 2 has written notes.

### 1. Land measured XA fenestration

Merge [PR #22](https://github.com/vedalkenDev/Plancheck/pull/22) (`cursor/measure-schedule-fenestration-938e`) onto `main`.

When the window schedule prints overall sizes, XA 4.4.4 must measure glazed area ÷ nett floor per storey instead of trusting the titleblock percentage. Mismatches fail with a unit cut. Marine Drive with no sizes keeps 16.9% / 17.1% and the 7.05 m² / 7.71 m² cuts.

**Done:** PR merged, Vercel build green, Marine Drive and Hartley fixtures still match the handoff.

### 2. Write where the note-sniffers lie

Run Marine Drive and Hartley as plotted council PDFs through the live flow (upload → tables → checklist → annotated PDF). For each failed and passed row, note whether the engine measured something or only found a keyword (`soakpit`, `stair`, `engineer`).

Write the findings at the bottom of this file under **Sniffer log**. That log is the input for item 3.

**Done:** both samples exercised end to end; the log lists every check that is still a sniff.

### 3. Make one more check real

Pick **one** from the sniffer log. Prefer:

- **Part N** window type elevations (overall + each pane in free space), or
- **Part M** stair dimensions (riser / going, not merely the word “stair”).

Implement that check so a fail says what to change and by how much when the sheet has numbers. Leave the rest as sniffers.

**Done:** one new or rewritten rule with tests against the ground-truth samples; no new product surface.

## Out of scope this week

- Scanned raster PDFs
- Measuring glazing from anonymous wall paths or CAD pane geometry
- Rewriting the drawing
- Cadcraft, PostHog, DWG/DXF in the UI
- Naming the SANS clause on every row (closed PR #13)

## Sniffer log

Empty until item 2 runs.
