# Phoenix search + LiveTrip companion pack

This ZIP accompanies the original Vibe Code app. It is a **reference handoff**, not a standalone iOS project or a database export. It contains the current Phoenix web implementation of the customer aircraft-search screen and LiveTrip flight tracker, plus the images, map reference data, and an API contract for a mobile port.

Source snapshot: Phoenix Platform commit `447cb83` (2026-09-24). No credentials, environment files, customer records, or production airport database are included.

## Where to start

1. Open `reference-ui/Search.tsx` with `search-refined.css` for the compact search flow and aircraft/class result cards.
2. Open `reference-ui/SearchRoute.tsx` for the animated route preview and LiveTrip SVG map. The animation follows a curved path, pulses the endpoints, and respects reduced-motion settings.
3. Open `reference-ui/LiveTrip.tsx` with `live-trip.css` for the customer tracker, status progression, telemetry, timeline, and responsive layout.
4. Use `assets/fleet/` for the approved category images and Malibu aircraft images. Use `assets/brand/` for the Phoenix logo and favicon references.
5. Read `contracts/API_HANDOFF.md` before connecting the iOS app. The JSON files there are **illustrative fixtures**, not real quotes or flights.

`reference-ui/styles.css` is the original app's global style context. It is included so typography, color tokens, card proportions, and buttons can be matched; it also contains unrelated global rules. Copy only the relevant styles into the target app. The React files refer to other Phoenix web modules and Next.js, so they are source/design references rather than a drop-in npm package.

## Search screen behaviors to preserve

- Compact one-way/round-trip form with airport/city search, dates, passengers, and optional trip details.
- Airport autocomplete comes from the backend, not a shipped airport database.
- Route preview: charcoal map, gold curved route, moving white airplane, endpoint pulses, and a short completion transition before results. Provide a nonanimated state for reduced-motion users.
- Result cards show category or aircraft image, title/model examples, seats, flight time and distance, relationship badge, operating carrier when known, and whole-trip estimate, range, or **Request quote**.
- Keep “Phoenix Aircraft,” “Partner Exclusive,” and “Partner Network” marketing labels distinct from the actual operating carrier. Do not make an example aircraft type look guaranteed.
- The class images in this pack are visual defaults. The backend can supply a different image path for a published offering. The white Malibu image is a specific-aircraft presentation asset, not the entire aircraft database.
- Price ranges and availability are backend results. Do not calculate a final charter quote solely in the app.

## LiveTrip behaviors to preserve

- Six states: aircraft assigned, positioning to pickup, at pickup, ready for boarding, customer en route, arrived.
- Large status message, live/scheduled map, latest aircraft position and telemetry, ETA/distance cards, two flight legs, progress timeline, and FBO instructions.
- The web client refreshes the live endpoint every 20 seconds; its map animates position transitions. Show the last-known/stale state rather than pretending old telemetry is live.
- The included web demo animation is a 45-second simulated walkthrough. It is not a live tracking feed.
- Keep the tracking token private in the app; never hard-code one in source or analytics.

## iOS integration boundary

Phoenix's deployment may host PostgreSQL on Supabase, but the current web app uses the **Phoenix API** for search, booking, and tracking. Supabase hosting is not itself a mobile API contract. The iOS app should call approved Phoenix endpoints with the intended customer authentication flow. Do not embed a Supabase service-role key, privileged database credentials, or direct table-write logic in the app. If a direct Supabase client is desired later, it needs a separate mobile auth/RLS and endpoint design review.

The current airport search endpoint does not return coordinates. The web route illustration uses `reference-ui/route-airports.json` as a static drawing lookup. Treat that file as an illustrative reference, **not** the live airport catalog. A mobile map should receive approved airport coordinates from an API extension (or a vetted map provider) while airport selection remains backend-controlled.

## Contents

| Path | Purpose |
| --- | --- |
| `reference-ui/Search.tsx` | Customer search interaction and result cards |
| `reference-ui/SearchRoute.tsx` | Route animation and LiveTrip map |
| `reference-ui/LiveTrip.tsx` | Customer flight tracker and demo-state logic |
| `reference-ui/AircraftImage.tsx`, `Calendar.tsx`, `Icon.tsx` | Direct visual dependencies |
| `reference-ui/search-refined.css`, `live-trip.css`, `styles.css` | Web appearance and animations |
| `reference-ui/route-boundaries.json`, `route-airports.json` | Illustrative web map geometry/lookups only |
| `assets/` | Approved visual reference assets |
| `contracts/` | API shapes and fictional example payloads |

To see the source app rather than this static handoff, open `/search` and `/trip/demo` on a running Phoenix web preview. The backend controls which offers are published, their prices, actual aircraft, operators, and airport records.
