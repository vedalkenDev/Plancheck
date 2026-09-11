# Plancheck

Vedalken product: architects upload a `.dwg` or `.dxf` and get a SANS 10400 pass/fail checklist before they submit. Finding first. Fixing is the job.

The app lives at [github.com/vedalkenDev/Plancheck](https://github.com/vedalkenDev/Plancheck). Uploads are read in the browser. DXF files are scanned for geometry, text, attributes, layers, and block names. DWG files are scanned for readable title and note strings. The UI never claims a stamp or municipal approval.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43173/plancheck](http://127.0.0.1:43173/plancheck). `/` redirects there.

```bash
npm test
npm run build
npm start
```

## Deploy on Vercel

No environment variables. Import this GitHub repo in Vercel and deploy as a Next.js app.

## Flow

1. Drag a `.dwg` / `.dxf` onto the left pane, or run a sample drawing.
2. A spinner runs while Plancheck inspects the file.
3. The left pane previews the drawing. The right pane shows passed SANS/NBR checks, failed checks, and a change checklist.

Council rules are encoded in `src/lib/sans/` from SANS 10400-A Form 1 (occupancy A20, owner/competent person A19), Parts D, K, M, N, O, R, S, T, XA, plus the Marine Drive and Hartley sample audits already in this repo.

Drawing read logic lives in `src/lib/cad/`.
