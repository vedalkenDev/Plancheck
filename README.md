# Plancheck

Vedalken product: architects upload a `.dwg` or `.dxf` and get a SANS 10400 pass/fail checklist before they submit. Finding first. Fixing is the job.

Uploads are read in the browser. DXF files are scanned for text, attributes, layers, and block names. DWG files are scanned for readable title and note strings. Samples in `src/data/` still load without a file. The UI never claims a stamp or municipal approval.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43173/plancheck](http://127.0.0.1:43173/plancheck). `/` redirects there.

```bash
npm run build
npm start
```

## Deploy on Vercel

No environment variables. Import this GitHub repo in Vercel and deploy as a Next.js app.

1. Open [vercel.com](https://vercel.com) and sign in.
2. **Add New… → Project** and import the `plancheck` GitHub repository.
3. Framework Preset: **Next.js**. Root Directory: `.`
4. Build Command: `npm run build` (default). Output: default (`.next`).
5. Click **Deploy**.
6. To serve the app at `vedalken.dev/plancheck`, add the domain in the Vercel project and point that path at this deployment (rewrite or `basePath` later if the site already occupies `/`).

## GitHub

This app is meant to live on your GitHub account, not on a Cursor Origin repo. Keep the existing `git` history when you publish:

```bash
gh repo create plancheck --public --source=. --remote=github --push
```

Or create an empty `plancheck` repo on GitHub, then:

```bash
git remote add github https://github.com/<you>/plancheck.git
git push -u github main
```

## Flow

1. Upload a `.dwg` / `.dxf`, or run a sample audit.
2. An uploaded drawing is read for addresses, occupancy, fenestration, stairs, stormwater, signatures, and leftover title text.
3. Result view: project meta, PASSED table, FAILED items with what to adjust, disclaimer, annotated drawing download, checklist (`.txt`) download.

Samples live in `src/data/` as JSON (Marine Drive H4 and Hartley TEST2 G1). Drawing read logic lives in `src/lib/cad/`.
