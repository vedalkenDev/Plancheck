# Plancheck

Vedalken product: architects upload a drawing and get a SANS 10400 pass/fail checklist before they submit. Finding first. Fixing is the job. Luqmaan Sayed.

The live line is [github.com/vedalkenDev/Plancheck](https://github.com/vedalkenDev/Plancheck). Path discussed: [vedalken.dev/plancheck](https://vedalken.dev/plancheck).

Uploads are read in the browser. Not a stamp. Not municipal approval. Competent person and owner signatures still required.

Product, engine pipeline, SANS drawing rules, and sample ground truth: [`docs/BLG-HANDOFF.md`](docs/BLG-HANDOFF.md). Dark dashboard is the UI.

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

1. Choose a drawing file (.dwg or .dxf), or run a sample.
2. Read the pass/fail tables. Failed items include what to adjust.
3. Download a `.txt` checklist and an annotated drawing. Real DWG-out needs a server-side CAD worker (ODA) — see the handoff.
