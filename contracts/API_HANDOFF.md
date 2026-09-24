# API handoff for an iOS implementation

Base paths below are relative to the Phoenix API origin. These are the current web-facing contracts, not an instruction to query PostgreSQL/Supabase tables from the device.

| Purpose | Method and path | Notes |
| --- | --- | --- |
| Airport autocomplete | `GET /api/v1/airports?q=...` | Public list, max 20 results. Search city, airport name, IATA or ICAO. |
| City fallback | `GET /api/v1/airports/by-city?city=...&state=..` | Returns one candidate airport and requested city/state. |
| Customer catalog | `POST /api/v1/search` | Search request → `{ "items": AircraftOption[] }`. Published classes and partner offerings are curated by backend. |
| Account aircraft availability | `POST /api/v1/availability` | Existing signed-in booking path; do not substitute for public catalog without product decision. |
| Begin booking | `POST /api/v1/booking-sessions` | Existing web sign-in/claim flow. Mobile-specific login/claim flow needs to be agreed before implementation. |
| LiveTrip | `GET /api/v1/live-trips/{token}` | Tokenized customer view. Web refresh interval: 20 seconds. |
| Published offering image | `GET /api/v1/catalog-images/{offeringId}` | Only published image is public; use returned image path from search results. |

`search-request.example.json`, `search-response.example.json`, and `live-trip-response.example.json` show field shapes. All values are fictional. The authoritative server validation and live response may evolve; generate typed mobile models from the active API/OpenAPI before release.

## Important field semantics

- Search times are ISO 8601 UTC instants plus an IANA `timezone`; a date-only string is not accepted by the search API.
- `priceMode` is `estimate`, `range`, or `quote`. `indicativeCents` and `maximumCents` are customer-facing estimates in integer cents. For `quote`, display **Request quote**, not `$0`.
- `availability` is `request_review` or `unavailable`. A request-review result is not confirmed aircraft availability.
- `relationship` is the Phoenix marketing relationship; `operatorName` is the operating carrier when already known. If operator name is absent, it must be confirmed with the quote.
- `image` is a backend-provided web path. Resolve it against the approved Phoenix origin; do not construct aircraft image names from model or tail number.
- LiveTrip `position.stale` signals last-known position. A null position means no live aircraft position is available. Avoid showing a moving aircraft or current ETA from stale/null telemetry.
- LiveTrip status and trip information come from the backend. The included UI demo is fictional and must never be conflated with a real trip.

## Security and data ownership

- Supabase is Phoenix's managed PostgreSQL host in the planned deployment, not a license for direct device access to internal tables.
- Never ship database passwords, service-role keys, or tracking tokens in app assets. Use customer authentication and the Phoenix API's access controls.
- Keep operational carrier data and Phoenix brokerage presentation separate. Do not infer the operator from aircraft ownership or a card label.
- Airport records, aircraft, offers, prices, availability, and live positions are backend-owned. This ZIP contains no authoritative database snapshot.
