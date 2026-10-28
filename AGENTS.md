<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- Keep `PdfPreview` (chrome-free rendered sheet). Do not merge back to main's native PDF iframe.
- Keep review results as stacked lists, not `xl:grid-cols-2` tables.
- Say "drawing" and "checklist" in the UI; do not say DXF, MTEXT, or layer names.
- Plancheck is a pre-submission audit, not a stamp and not municipal approval.
- Corrector mode writes missing SANS notes (Part R, D, T, XA) onto empty paper and skips signatures, engineering packs, and measured sizes.
- Do not set React state synchronously inside `useEffect`; `react-hooks/set-state-in-effect` fails CI.

## Learned Workspace Facts

- App is Plancheck (Next.js 16.3.4, React 19); `npm run dev` binds `127.0.0.1:43173`.
- Ground-truth drawings: 69 Marine Drive occupancy H4 dwelling; 130 Hartley Road occupancy G1 medical offices.
- Login gate cookie `pc_gate` stores `email\nexp.sig` (payload contains a newline); naive CDP cookie injection fails unless that newline is preserved.
- Dark dashboard UI: drawing on the left third, analysis on the rest; notes pack into empty paper around the drawing, not onto the floor plan.
- Occupancy is read from the drawing; never hardcode one class for every upload. A20 is a regulation, not an occupancy class.
