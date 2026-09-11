# Xun visual lock

Design lock from Xun. GitHub Plancheck is the source of truth. The Origin Plancheck UI was a failed trial — do not copy it. Do not restore the dark SaaS dashboard. Do not rewrite engine / SANS / CAD rules to match this file.

## Product surface

Principals (non-technical architects) upload a `.dwg` / `.dxf`, get SANS pass/fail with what to adjust, then download a plain document and an annotated drawing. No stamp claim. Finding first; fixing is the job.

## Observable chrome

- Paper `#F3EFE6`, ink `#161513`, stone `#7A766C`. Bronze `#8A5A32` only on the offer line “The finding is free.”
- Serif (Newsreader) for the page-defining claim. Quiet sans for chrome, labels, tables.
- One continuous paper canvas. Hierarchy from type and space, not boxes.
- Header: left wordmark `Vedalken`, right at most `Plancheck`.
- Footer: `Luqmaan Sayed · vedalken.dev`.
- First fold is the finding / argument, not a hero photo, not a portfolio grid, not a dashboard.

## Anti-patterns

- `.md` downloads for end users. Checklist/report is plain `.txt`, labeled “Download checklist” / “Download report”. Never “Download checklist Markdown”.
- Card grids, gradients, glass, metric pills, dark-mode-default marketing, invented stamps/seals.
- Tech jargon in upload copy (“MVP”, “no CAD parser”). Prefer: “Choose a drawing file (.dwg or .dxf)”.

## Result view

- PASSED table: Check | Numbers/note | Status
- FAILED: each item includes what to adjust (not just Fail)
- Disclaimer always visible: “Not a stamp. Not municipal approval. Competent person and owner signatures still required.”
- Annotated drawing download labeled for architects, not engineers.
