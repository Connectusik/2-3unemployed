# BetterMe — Instant Wellness Kits
## Sales Tax Compliance Engine (Hackathon 2026)

Vite + React frontend with an Express + SQLite backend for New York sales tax calculation by coordinates.

🌐 **Live Production:**
https://hackathon2026-k208.onrender.com/

## Data sources (production-like)
- **Rates:** NYS Department of Taxation and Finance, Publication 718 PDF  
  `https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf`
- **Geography:** US Census TIGERweb (TIGER/Line service layers)
  - Counties (`State_County/MapServer/1`)
  - Incorporated places (`Places_CouSub_ConCity_SubMCD/MapServer/4`)

Generated artifacts are committed so the app works offline:
- `src/data/ny/tax-rates.generated.json`
- `src/data/ny/ny-counties.geojson`
- `src/data/ny/ny-places.geojson`

## Local run
1. Install dependencies: `npm install`
2. Start server: `npm run dev`
3. Open: `http://localhost:3000`

Default credentials:
- `username: admin`
- `password: SecureAdmin2026!`

## Update NY datasets
- Rates from Publication 718:
  `npm run update:ny:rates`
- Counties/places geodata:
  `npm run update:ny:geo`
- Update everything:
  `npm run update:ny:data`

Optional overrides for the rates script:
- `PUB718_URL=<url> npm run update:ny:rates`
- `PUB718_PATH=/absolute/path/to/pub718.pdf npm run update:ny:rates`

## Smoke check
Run quick sanity check for NYC, Buffalo, Albany:
- `npm run smoke:tax`

The check verifies:
- county detection works,
- `composite_tax_rate = state + county + city + sum(special_rates)`.

## Tax model notes
- `state_rate = 0.04`
- `MCTD = 0.00375` for applicable counties
- `breakdown.special_rates` is an array of named rates (currently `MCTD` when applicable)
- `city_rate` represents locality uplift above county local part

## Assumptions
- Publication 718 is parsed from PDF text extraction and mapped to county + listed locality exceptions.
- Borough counties (`Bronx`, `Kings`, `New York`, `Queens`, `Richmond`) use NYC rate.
- Locality exceptions are matched by place polygon + normalized name.
- For DB backward compatibility, legacy `special_rate` is kept and mirrored into `special_rate_total` / `special_rates`.

## API
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/orders`
- `POST /api/orders/import`
- `GET /api/orders?page=1&limit=10`
- `GET /api/failed-requests`
- `DELETE /api/history`

## Deploy overview
- `frontend` (React/Vite) -> static hosting (or served by backend in production mode)
- `backend` (`server.ts`, SQLite, `/api/*`) -> Node host (Render/Railway/Fly.io/VPS)

If hosting frontend separately, set `VITE_API_URL` to backend public URL.
