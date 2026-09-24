# Visual and interaction notes for the iOS port

The exact web source is in `reference-ui/`. Use the current Phoenix app as the visual truth; these notes translate its intent to native controls rather than recommending a WebView.

## Phoenix visual language

- Canvas: mostly white/light gray for search, charcoal for route maps, warm off-white for LiveTrip.
- Primary gold: `#c9a227`; darker hover/pressed gold: `#b18f22`; subtle gold surface: `#fbf8ee`; dark gold text: `#765b09`; primary ink: `#222222`.
- Typography: compact, restrained weights; Manrope is used for display text in the web build, with Geist Sans elsewhere. Use licensed/available native equivalents if those fonts are not shipped in the original app.
- Search cards: white surface, fine gray border, 12px corner radius, no heavy shadow. Image, class title/model, metrics, badges, estimate, and CTA form one compact hierarchy.
- Partner/aircraft photos have distinct roles. The four `category-*.webp` images are generic class cards; `malibu-studio.webp` is a specific-aircraft card; `malibu-transparent.png` is the white aircraft cutout used in LiveTrip.
- Phoenix bird logo is `assets/brand/phoenix_gold-1763274942834.png`. The favicon files are references for app-icon exploration, not necessarily production-ready iOS icon sizes.

## Search transition

The web route animation starts after a valid search, draws the gold route, moves a white aircraft along it, pulses endpoints, and reveals results. Its scripted sequence is about five seconds in `SearchRoute.tsx`; the loading copy and shimmer are in `Search.tsx` / `search-refined.css`. On iOS, the route could be drawn in a SwiftUI Canvas or overlay on a native map, but keep the result timing tied to the actual API response and provide a reduced-motion alternative. Do not delay or fabricate data just for the animation.

The illustrative web map is built from `route-boundaries.json`; it is not a navigation chart or live aeronautical map. Use a suitable native map and authoritative coordinates for real mobile route rendering. Search airport selection remains driven by the backend.

## LiveTrip

The customer screen changes headline, pill, two legs, progress steps, and priority cards with the backend status. The live map animates the aircraft between received positions and displays altitude, ground speed, and last-known state. Keep the telemetry label and stale indication visible; never extrapolate a live location indefinitely. `LiveTrip.tsx` contains a demo-only 45-second simulation for presentation, distinct from the tokenized live API flow.

For a native build, split this into `SearchForm`, `RoutePreview`, `OfferingCard`, `TripStatus`, `TripMap`, `TripLeg`, and `FlightProgress` views backed by typed API models. Keep backend ownership of operator, aircraft, prices, airport selection, and tracking state; the app owns presentation and local input state.

## Acceptance checks

1. A search with no published offers shows a truthful empty state rather than static demo cards.
2. A range offer displays lower–upper estimate; a quote-only offer says **Request quote** and never `$0`.
3. Partner/network badges do not replace the “Operated by …” attribution.
4. Changing airports or dates invalidates old search results while the new query runs.
5. Reduced Motion disables the plane/route and pulsing animations without hiding route or result information.
6. LiveTrip with null/stale position never claims a current aircraft position; the last-known state is explicit.
7. Images load from backend-provided paths when an offering uses an uploaded image, with local defaults only where appropriate.
