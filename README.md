# blerglams

A personal album tracker: log the albums you listen to, rate them 1–10, and note when you listened. Search Spotify's catalog to add albums with artwork pulled in automatically, save albums you want to get to later, and get recommendations based on artists behind the albums you've rated highly. Works as an installable web app (PWA) on your phone, iPad, and computer.

## Features

- **Library** (`/`) — everything you've logged, sortable by recently added, highest rated, title, or release date
- **Saved** (`/saved`) — a wishlist of albums you want to listen to but haven't yet; one tap moves an album to your library once you've heard it
- **Recommended** (`/recommendations`) — artists similar to the ones behind whatever you've rated 7 or higher, with albums pulled live from Spotify's catalog, excluding anything already in your library or saved list
- **Add album** (`/search`) — search Spotify's full catalog and either add straight to your library or save for later

## Stack

- Next.js (App Router) + TypeScript, deployed on [Vercel](https://vercel.com) (free tier)
- [Postgres](https://neon.com) via [Neon](https://neon.com) (free tier) + Prisma ORM
- Spotify Web API (Client Credentials flow) for catalog search and artwork — no user Spotify login required
- [Last.fm API](https://www.last.fm/api) for similar-artist recommendations — free, key-only, no OAuth
- Single shared passphrase for app access (this is a personal, single-user app)

## How Spotify integration works

Spotify's API does not expose a user's full historical listening history — only the last ~50 played tracks, and only via a personal OAuth login. To keep this simple and avoid you having to log into Spotify inside the app, blerglams instead lets you **search Spotify's full catalog** (any album, any artist, any era) and add matches to your library with artwork and release date pulled in automatically. You then rate it and log when you listened, as many times as you like.

---

## 1. Create a Spotify Developer app (~5 minutes)

1. Go to https://developer.spotify.com/dashboard and log in with your Spotify account.
2. Click **Create app**.
   - App name: anything, e.g. "blerglams"
   - App description: anything, e.g. "personal album tracker"
   - Redirect URI: not used by this app, but Spotify requires one — enter `https://example.com/callback`
   - Which API/SDKs are you planning to use: check **Web API**
3. Click **Save**, then open the app and click **Settings** to find your **Client ID** and **Client secret**. Keep this tab open — you'll paste these into Vercel shortly.

## 2. Get a free Last.fm API key (~2 minutes)

Used only to find artists similar to the ones you've rated highly — Spotify no longer offers this for new developer apps, so Last.fm's community-driven similarity data fills the gap.

1. Go to https://www.last.fm/api/account/create and sign in (or create a free Last.fm account).
2. Fill in an application name (anything, e.g. "blerglams") and contact email. Application homepage / callback URL can be left blank or filled with any placeholder — they're not used by this app.
3. Submit — your **API key** is shown immediately on the next page. No secret or approval wait needed.

## 3. Create a free Postgres database on Neon

1. Go to https://neon.com and sign up (free tier is plenty for this app).
2. Create a new project (any name/region).
3. On the project dashboard, copy the **connection string** (the "pooled connection" / `DATABASE_URL` shown for Prisma or generic Postgres). It looks like:
   `postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require`

## 4. Deploy to Vercel

1. Push this repository to your own GitHub account (or use the one it's already in).
2. Go to https://vercel.com, sign up/log in, and click **Add New → Project**, then import this repo.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 3 |
   | `SPOTIFY_CLIENT_ID` | from step 1 |
   | `SPOTIFY_CLIENT_SECRET` | from step 1 |
   | `LASTFM_API_KEY` | from step 2 |
   | `APP_PASSWORD` | any passphrase you'll use to log into the app |
   | `AUTH_SECRET` | a random secret — generate one locally with `openssl rand -hex 32` |

4. Click **Deploy**.
5. Once deployed, initialize the database schema. The easiest way is from your own machine:
   ```bash
   git clone <your-repo-url>
   cd blerglams
   npm install
   DATABASE_URL="<paste your Neon connection string>" npx prisma db push
   ```
   This creates the `Album` and `Listen` tables. You only need to do this once (and again after any future schema change).
6. Visit your Vercel URL — you should see the login screen. Enter the `APP_PASSWORD` you set above.

## 5. Install it on your devices

Once deployed, open the Vercel URL on each device and add it to the home screen so it behaves like an app:

- **iPad 9 / iPhone (Safari):** open the site → tap the Share icon → **Add to Home Screen**.
- **Android (Chrome):** open the site → menu (⋮) → **Add to Home screen** / **Install app**.
- **Home computer:** just bookmark it, or in Chrome/Edge click the install icon in the address bar.

All devices share the same library since it's backed by one database — add an album on your phone and it shows up everywhere.

---

## Updating an existing deployment's database

Whenever the app's data model changes (like the Saved/Recommendations feature below, which added a `status` field and an `artistId` field to albums), your Neon database needs the same one-time update the initial setup used. Pick whichever of these you did before:

**Option A — Neon SQL Editor (no install needed):** go to your Neon project → **SQL Editor**, paste this, and run it:

```sql
CREATE TYPE "AlbumStatus" AS ENUM ('LIBRARY', 'SAVED');

ALTER TABLE "Album" ADD COLUMN "artistId" TEXT;
ALTER TABLE "Album" ADD COLUMN "status" "AlbumStatus" NOT NULL DEFAULT 'LIBRARY';

CREATE INDEX "Album_status_idx" ON "Album"("status");
```

**Option B — from your terminal:**

```bash
git pull
npm install
DATABASE_URL="<your Neon connection string>" npx prisma db push
```

Either way, all your existing albums default to `status = LIBRARY`, so nothing already in your library moves or changes — this only adds the new Saved/Recommendations capability going forward.

**Adding Last.fm-based recommendations to an already-deployed app:** no database change needed for this one — just get a key (see step 2 above), add `LASTFM_API_KEY` to Vercel's Environment Variables, and redeploy.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, SPOTIFY_CLIENT_ID/SECRET, LASTFM_API_KEY, APP_PASSWORD, AUTH_SECRET
npx prisma db push           # creates tables in your DATABASE_URL
npm run dev                  # http://localhost:3000
```

You'll need a Postgres instance to point `DATABASE_URL` at locally too — either a local Postgres install, a Docker container, or just point at your Neon dev branch.

## How it's organized

- `src/app/` — pages: library home (`/`), saved wishlist (`/saved`), recommendations (`/recommendations`), Spotify search (`/search`), album detail (`/album/[id]`), login (`/login`)
- `src/app/api/` — route handlers: albums CRUD, listen-log CRUD, Spotify search proxy, recommendations, auth
- `src/lib/spotify.ts` — Spotify Client Credentials token fetch, catalog search, artist lookup, and artist-albums fetch
- `src/lib/lastfm.ts` — Last.fm `artist.getsimilar` lookup, the primary signal behind Recommendations
- `src/lib/auth.ts`, `src/proxy.ts` — passphrase-based session cookie + route protection
- `src/hooks/useCatalogActions.ts`, `src/components/SpotifyResultCard.tsx` — shared "add to library / save for later" logic used by both the Search and Recommendations pages
- `prisma/schema.prisma` — `Album` (rating, artwork, metadata, `status` of LIBRARY or SAVED) and `Listen` (date + note, many per album)

## How recommendations work

Spotify deprecated both its old personalized recommendations endpoint and its "Related Artists" endpoint for apps created after November 2024, and its per-artist genre tags turned out to be too sparse to rely on either. So for each artist behind an album you've rated 7 or higher, recommendations are found in three tiers, each tried only if the previous one comes up empty:

1. **Last.fm's `artist.getsimilar`** — real similar-artist data from Last.fm's community listening/tagging history. This is the primary source and should cover the large majority of artists.
2. **Spotify genre-tag overlap** — a weaker fallback for the rare artist Last.fm doesn't recognize.
3. **More albums from the artist itself** — a last resort so a section never comes up completely empty.

Known artists (anyone already in your library or saved list) are always excluded, so results are genuinely new discoveries. If a section looks thin, it's usually because you haven't rated enough albums 7+ yet.

## Notes

- Ratings are 1–10 integers; tap the same number again on an album's page to clear it.
- Each album can have multiple listen-log entries (date + optional note), so you can track relistens over time.
- The app password is a single shared passphrase — this app is designed for one person's personal use across their own devices, not multi-user accounts.
