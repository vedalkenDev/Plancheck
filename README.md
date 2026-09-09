# Plancheck

Vedalken product: architects upload a `.dwg` or `.dxf` and get a SANS 10400 pass/fail checklist before they submit. Finding first. Fixing is the job.

This MVP renders two embedded sample audits. It does not parse CAD. Knight owns the live audit engine later. The UI never claims a stamp or municipal approval.

Bin will host this under `vedalken.dev/plancheck`.

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

## Flow

1. Upload a `.dwg` / `.dxf`, or run a sample audit.
2. Any uploaded drawing maps to the Hartley TEST2 sample and shows a note that live engine wiring is next.
3. Result view: project meta, PASSED table, FAILED items with what to adjust, disclaimer, annotated drawing download, checklist (.txt) download.

Samples live in `src/data/` as JSON (Marine Drive H4 and Hartley TEST2 G1).
