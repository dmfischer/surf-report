# Map library research: Leaflet vs MapLibre (and others)

Researched 2026-11-11 by a Claude Code sub-agent. Versions and release dates come from the npm registry, and bundle sizes were measured from jsDelivr (minified, then gzipped locally). Tile pricing and policies come from each provider's page on that date. Anything marked *[mem]* is from memory and wasn't checked.

**The first feature:** markers for the zip location and the tide station, a line between them, and fit bounds.
**Later:** many surf-spot markers colored by how well conditions suit them, swell and wind direction arrows, and maybe coastline overlays.
**Constraints:** the developer is new to React, wants no paid accounts, and the project may go public.

## 1. Recommendation

**Use MapLibre GL JS with `@vis.gl/react-maplibre` and OpenFreeMap tiles.**

- **Cost:** OpenFreeMap needs no key and no account, has no view limits, allows commercial use, and includes a **Dark** style ([openfreemap.org](https://openfreemap.org/)). That covers both "free now" and "might go public".
- **The later feature is where MapLibre is strongest.** It draws "colored spots + direction arrows" from one GeoJSON source:
  - a `circle` layer whose `circle-color` comes from each spot's score property, and
  - a `symbol` layer with `icon-rotate` set to the swell direction.
  
  The GPU renders thousands of features this way with no per-marker DOM elements and no plugins.
- **The first feature stays small:** `<Map>`, two `<Marker>`s, a GeoJSON `LineString` in a `<Source>`/`<Layer>`, and `map.fitBounds()`.

**Costs of this choice:**
- A much larger bundle (about 300 KB gzipped plus a web worker).
- A second "language" to learn: the style spec and its expressions.

If that feels like too much while learning React, Leaflet is a reasonable first step. See section 5.

## 2. Comparison

| | **Leaflet + react-leaflet** | **MapLibre GL JS + @vis.gl/react-maplibre** | OpenLayers | Google Maps | Mapbox GL JS |
|---|---|---|---|---|---|
| Rendering | DOM/SVG, optional Canvas; raster tiles | WebGL; vector tiles (raster also works) | Canvas/WebGL; raster and vector | Vector (WebGL) | WebGL; vector |
| Version (≥2 weeks old) | `leaflet` 1.9.4 (2023); `react-leaflet` 5.0.0 (Dec 2024). Leaflet 2.0 is in beta | `maplibre-gl` 6.16.0 (Oct 25)\*; `@vis.gl/react-maplibre` 8.1.3 (Sep 2) | `ol` 10.11.0 (Oct 4) | `@vis.gl/react-google-maps` 1.10.2 | `mapbox-gl` 3.34.2 |
| React 19 | Yes (react-leaflet 5 requires `react ^19`) | Yes (peer `react >=16.3`) | No official wrapper | Yes (official wrapper) | Yes, via `react-map-gl` |
| JS size, gzipped | ~43 KB + 4 KB CSS | ~295 KB main + ~147 KB worker + 10 KB CSS | Tree-shakable; mid-range *[mem]* | Loaded from Google | Similar to MapLibre *[mem]* |
| TypeScript | `@types/leaflet`; react-leaflet bundles types | Bundled types for both | Bundled types | Bundled types | Bundled types |
| Learning curve | Lowest | Medium (style spec) | Highest | Low to medium | Medium |
| Free tiles | OSM (with a usage policy), or a free tier | OpenFreeMap (no key) | Either | 10k loads/month, billing account needed *[mem]* | 50k loads/month, token needed |

\* `maplibre-gl` 6.17.0 (Nov 7) and 6.18.0 (released today) are under the two-week bar.

## 3. Options

### Leaflet + react-leaflet

**Pros:**
- The smallest bundle and the easiest mental model.
- Very idiomatic React. `<MapContainer>`, `<TileLayer>`, `<Marker>` and `<Polyline>` are ordinary components, so it doubles as React practice.
- Huge ecosystem: 45.9k GitHub stars, and lots of tutorials.

**Cons:**
- **Raster tiles.** You either use OSM's tile server or sign up for a provider.
  - The [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) requires visible attribution and a valid Referer. It forbids prefetching and offers "no SLA or guarantee". It's fine for development and a small hobby site, but risky if the site gets popular.
- **Dark mode** needs a different raster tile set (a provider account) or a CSS `filter: invert()` hack.
- **Arrows** need a DivIcon per marker, rotated with CSS. That's fine for dozens or hundreds of spots, but every marker is a DOM node.
- **Churn ahead:** Leaflet 2.0 is in beta (`2.0.0-beta.3`, Nov 10), but react-leaflet 5 (last released Dec 2024) depends on `leaflet ^1.9`; Leaflet 2 support is an open issue ([#1165](https://github.com/PaulLeCam/react-leaflet/issues/1165)).
- react-leaflet's license (Hippocratic 2.1) isn't OSI-approved; harmless for a hobby app.

### MapLibre GL JS + @vis.gl/react-maplibre

**Pros:**
- Open-source fork of Mapbox GL v1 (BSD-3), very actively maintained, with weekly releases.
- Vector tiles mean crisp zooming and free restyling. Light and dark themes are just two style URLs.
- **Data-driven styling** (`["interpolate", …]`, `["get", "score"]`) maps directly to "color spots by score". `icon-rotate` handles direction arrows.
- GeoJSON in, GeoJSON out, which fits the server.
- `@vis.gl/react-maplibre` is the MapLibre-only build of `react-map-gl` (8.5k stars, last push Oct 24). It's maintained by the vis.gl/OpenJS team.
- Free tile sources:
  - **OpenFreeMap:** free, no key, commercial use OK.
  - **[Protomaps](https://protomaps.com/api):** free key for non-commercial use, or self-host a single `.pmtiles` file.
  - **[MapTiler](https://www.maptiler.com/cloud/pricing/):** free tier of 5k map loads a month, non-commercial, no credit card. The service pauses when you go over.
  - **[Stadia](https://stadiamaps.com/pricing/):** 200k credits a month, but the free plan doesn't allow commercial use.

**Cons:**
- About 10× Leaflet's JavaScript. Mitigate by lazy-loading the map route with `React.lazy`.
- Needs WebGL (universal now, but it fails in some locked-down or VM environments).
- Lines and overlays are layers with style JSON rather than JSX components. This is a second concept to learn alongside React.
- OpenFreeMap is donation-funded with no SLA. If it disappears, the fallback is to swap the style URL to MapTiler or self-hosted Protomaps.

### Others, briefly

- **OpenLayers:** the most capable GIS toolkit, but it has no maintained official React wrapper and the steepest API. Overkill here.
- **Google Maps** (`@vis.gl/react-google-maps`): polished, but needs a Cloud project with billing enabled *[mem]*. The free cap is 10,000 dynamic map loads a month ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)). That breaks the "no paid accounts" goal.
- **Mapbox GL JS:** excellent, and 50k free loads a month ([pricing](https://www.mapbox.com/pricing)). However, v2+ is proprietary, requires an access token, and every load counts against your account *[mem]*. MapLibre gives nearly the same API without the account.

## 4. Suitability for the "colored spots + arrows" feature

| Need | Leaflet | MapLibre |
|---|---|---|
| Color by score | Set `pathOptions.color` per `<CircleMarker>` in React | One `circle-color` expression on the layer |
| Rotated arrows | DivIcon + CSS `transform: rotate()` per marker | `symbol` layer, `icon-rotate: ["get","swellDir"]` |
| Hundreds to thousands of spots | Use `preferCanvas`; arrows stay DOM | Fine, since it's all on the GPU |
| Coastline/region overlays | `<GeoJSON>` component | `fill`/`line` layers |
| Dark mode | Needs another tile provider | Swap the style URL |

## 5. What would change the recommendation

- **"I want the gentlest possible React learning experience first"**: choose Leaflet with OSM tiles for the first feature. It's about 20 lines of pure JSX. Revisit when surf spots arrive. The markers-and-line code is small, so porting it later is cheap.
- **Bundle size matters, or spots stay few (under ~50) with no dark mode:** Leaflet's simplicity wins.
- **The site goes public with real traffic:** MapLibre stays the choice. Self-host Protomaps PMTiles, or pay a provider, rather than depending on a donation-run service. If you're on Leaflet at that point, you must leave OSM's tile server anyway.
- **You need satellite imagery, Street View or Places search:** Google Maps, accepting the billing account.
