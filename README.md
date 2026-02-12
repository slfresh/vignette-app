# European Vignette Portal

Independent route-based vignette guidance for Europe. The app analyzes a route, detects likely toll and vignette obligations by country, and links only to official operator websites.

## Core principles

- Official-source links only (no reselling).
- Informational-only legal posture with visible disclaimers.
- Server-side routing logic to keep API keys private.
- Consent-first loading for optional affiliate tracking modules.

## Tech stack

- Next.js App Router and TypeScript
- Tailwind CSS
- OpenRouteService directions metadata
- OpenStreetMap and Leaflet map rendering

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Set `ORS_API_KEY` in `.env.local`.
   - For production-grade rate limiting, also set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   - If Upstash variables are missing, the app falls back to in-memory rate limiting (single-instance only).
   - Set `APP_CONTACT_EMAIL` for geocoding user-agent identification.
   - Set `APP_PUBLIC_URL` for canonical metadata, robots, and sitemap.

4. Run dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Scripts

- `npm run dev`: start development server
- `npm run build`: production build
- `npm run start`: run production build
- `npm run lint`: lint
- `npm run typecheck`: TypeScript check
- `npm run test`: unit tests (Vitest)

## Legal pages included

- `/impressum`
- `/datenschutz`
- `/haftungsausschluss`

These pages are starter templates and must be replaced with your real legal details before going live.

## Security and compliance notes

- API keys are used only on server endpoints.
- Optional affiliate blocks are feature-flagged and consent-gated.
- Map tile provider IP transfer is disclosed in privacy content.
- Legal page operator details are loaded from `LEGAL_*` environment variables.

## Deployment target

This project is prepared for container deployment on Hetzner with Dokploy or Coolify using the included `Dockerfile`.

## Launch checklist

Follow `docs/predeploy-checklist.md` before going live.
