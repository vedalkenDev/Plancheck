# Plancheck

Vedalken product: architects upload a drawing and get a SANS 10400 pass/fail checklist before they submit. Finding first. Fixing is the job. Luqmaan Sayed.

The live line is [github.com/vedalkenDev/Plancheck](https://github.com/vedalkenDev/Plancheck). Path discussed: [vedalken.dev/plancheck](https://vedalken.dev/plancheck).

Uploads are read in the browser. This is a **pre-submission audit** — not a stamp, not municipal approval, not a competent-person substitute.

Product, engine pipeline, SANS drawing rules, and sample ground truth: [`docs/BLG-HANDOFF.md`](docs/BLG-HANDOFF.md).

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43173/plancheck](http://127.0.0.1:43173/plancheck). `/` redirects there.

```bash
npm test
npm run build
```

## Flow

1. Drag a drawing onto the left pane, or run a sample.
2. A spinner runs while Plancheck inspects the file.
3. Left: drawing preview. Right: passed table, failed table, what-to-change checklist.
4. Download a `.txt` checklist and an annotated drawing (DXF with council notes). Real DWG-out needs a server-side CAD worker (ODA) — see the handoff.
