# Plancheck

Vedalken product: architects upload a drawing and get a SANS 10400 pass/fail checklist before they submit. Finding first. Fixing is the job. Luqmaan Sayed.

The live line is [github.com/vedalkenDev/Plancheck](https://github.com/vedalkenDev/Plancheck). Path discussed: [vedalken.dev/plancheck](https://vedalken.dev/plancheck).

Uploads are read in the browser. Not a stamp. Not municipal approval. Competent person and owner signatures still required.

Product, engine pipeline, SANS drawing rules, and sample ground truth: [`docs/BLG-HANDOFF.md`](docs/BLG-HANDOFF.md). Dark dashboard is the UI.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the PlanCheck Supabase URL and publishable key, plus `WAITLIST_SHEET_URL` and `WAITLIST_SECRET`. Sign-in is an email field; it does not use Google.

Open [http://127.0.0.1:43173/login](http://127.0.0.1:43173/login). Unauthenticated visits to `/` and `/plancheck` redirect there.

```bash
npm test
npm run build
```

## Sign-in

Write an email on `/login`. Allowed addresses open `/plancheck`. Any other address lands on `/waitlist`, where we collect name, email, and position into the waitlist sheet.

## Flow

1. Enter an allowed email, or leave a name on the list.
2. Choose a council PDF, or run a sample.
3. Read the pass/fail tables. Failed items include what to adjust.
4. Download a `.txt` checklist and an annotated PDF. Notes sit in empty paper around the drawing, not on the plan.
