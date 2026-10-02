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

Fill `.env.local` with the PlanCheck Supabase URL, publishable key, and the allowed Google emails (`PLANCHECK_ALLOWED_EMAILS`).

Open [http://127.0.0.1:43173/login](http://127.0.0.1:43173/login). Unauthenticated visits to `/` and `/plancheck` redirect there.

```bash
npm test
npm run build
```

## Sign-in (two Google accounts)

Plancheck currently allows two Google users, set in `PLANCHECK_ALLOWED_EMAILS`. After Google returns, those accounts open the product. Any other account lands on `/waitlist`, where we collect name, email, and position into the `waitlist` table.

Google OAuth still needs a one-time provider setup:

1. In [Google Auth Platform](https://console.cloud.google.com/auth/clients), create a **Web application** OAuth client.
2. Authorized JavaScript origins: `http://127.0.0.1:43173` and the production origin.
3. Authorized redirect URI: `https://feusartgnihrpzxpyrrm.supabase.co/auth/v1/callback`.
4. In the [PlanCheck Google provider](https://supabase.com/dashboard/project/feusartgnihrpzxpyrrm/auth/providers), paste the Client ID and Client Secret and enable Google.
5. Add these Redirect URLs under [URL configuration](https://supabase.com/dashboard/project/feusartgnihrpzxpyrrm/auth/url-configuration):
   - `http://127.0.0.1:43173/auth/callback`
   - the production `/auth/callback` URL

Until Google is enabled in Supabase, the login button returns `Google sign-in didn't start`.

## Flow

1. Sign in with an allowed Google account, or leave a name on the list.
2. Choose a drawing file (.dwg or .dxf), or run a sample.
3. Read the pass/fail tables. Failed items include what to adjust.
4. Download a `.txt` checklist and an annotated drawing. Real DWG-out needs a server-side CAD worker (ODA) — see the handoff.
