# One-tap Cem SEO link

How it works: Pipelume > Settings > Connect Cem SEO creates a connector key and opens the Cem SEO connect page. The user signs in to Cem SEO,
the page sends the key to the Cem SEO backend (`POST /api/pipelume/link`), and the backend stores it encrypted and sends the user's Clients
(and a note after each audit) to that workspace. Needs the Cem SEO Agency plan, because Clients are an Agency feature.

Files (copy into the Cem SEO repo, same paths):
- `backend/src/services/pipelumeSchema.js`  new table `pipelume_links`
- `backend/src/services/pipelume.js`        sync logic
- `backend/src/routes/pipelume.js`          /api/pipelume/status, /link, /sync
- `backend/src/index.js`, `routes/agency.js`, `routes/audit.js`  full files with 3 to 4 added lines each (marked by `pipelume`)
- `docs/connect-pipelume.html`              the page users land on

Render environment variables: `PIPELUME_URL` (the Pipelume Supabase project URL), `PIPELUME_ANON_KEY` (its public anon key).
Optional: `PIPELUME_LINK_SECRET` (encrypts stored keys; defaults to JWT_SECRET).
Pipelume database: run `supabase/update-cem-link.sql` once (adds `check_api_key`).
