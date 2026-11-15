# Spot conditions map: which breaks are "working"

Researched 2026-11-11 by a Claude Code sub-agent. This builds on [buoy-swell-data.md](buoy-swell-data.md) (swell sources) and [wind-data.md](wind-data.md) (wind sources and the offshore/onshore math), and doesn't repeat them. It's a high-level note for making design decisions. Nothing here was prototyped.

## 1. What makes a spot work (primer)

A spot is a fixed piece of coastline. Whether it "works" depends on how the day's swell, wind and tide line up with that geometry.

| Factor | What matters | Rough rule |
|---|---|---|
| **Swell direction** | Must come from inside the spot's **swell window**: the arc of open ocean it faces, less anything blocked by headlands or islands | Outside the window, the spot is flat, whatever the size |
| **Swell period** | Longer period means more energy and cleaner lines, and more refraction around obstacles | Under 8 s is weak wind swell; 10–13 s is decent; 14 s or more is groundswell |
| **Swell size** | Each spot has a range it handles. Beach breaks close out when big; reefs and points need more size | Store a per-spot min/max |
| **Wind** | Measured against the beach-facing bearing (see wind-data.md §7). Offshore grooms waves; onshore chops them | Offshore or under about 5 kt: good. Cross-shore: fair. Onshore over about 10 kt: poor |
| **Tide** | Many spots only work at certain stages. Reefs can be too shallow at low tide; some beaches go fat at high tide | Store a per-spot preferred tide band (low/mid/high, or a height range) |
| **Bottom type** | Beach (shifting sand, inconsistent), reef (consistent, tide-sensitive), point (long peeling waves, needs the right direction) | Mostly changes how strict the other rules are |

Background: [Surf break (Wikipedia)](https://en.wikipedia.org/wiki/Surf_break).

## 2. Where spot data could come from

### Hand-curated spots table (recommended)

This is the only option that reliably has the fields that matter. Minimum fields:

`id, name, lat, lng, facingDeg, swellWindowMinDeg, swellWindowMaxDeg, minPeriodS, sizeRangeFt, idealTide ("low"|"mid"|"high"|"any"), breakType ("beach"|"reef"|"point"), tideStationId?, buoyId?`

The optional per-spot `buoyId` also fixes the RI "nearest buoy is the wrong buoy" problem (buoy-swell-data.md §7). With 10–30 spots near the test zips, this can be a JSON file in the repo rather than a database.

### Open datasets: useful for names and pins, not for the fields that matter

| Source | What you get | License | Verdict |
|---|---|---|---|
| OSM [`sport=surfing`](https://wiki.openstreetmap.org/wiki/Tag:sport=surfing) | Points or areas, always paired with another tag (`natural=beach`, `natural=reef`, `shop=surf`…). **No break-type or direction subtags** | ODbL (share-alike, attribution) | Sparse and mixed with surf shops and schools. Could seed names via Overpass |
| Wikidata [surf break (Q3482498)](https://www.wikidata.org/wiki/Q3482498) | Famous breaks with coordinates (e.g. [Currumbin Alley](https://www.wikidata.org/wiki/Q5195186)) | CC0 | Clean license, but thin coverage and no conditions data |
| [naotokui surf spots gist](https://gist.github.com/naotokui/01c384bf58ca43261eafe6a5e2ad6e85) | About 5,980 spots: name, country, lat/lng | **None stated**, unknown origin, some bad rows | Avoid for anything shared publicly |
| Surfline, Magicseaweed, etc. | Rich spot data | Proprietary | Not usable |

None of these provide swell windows, ideal tide or facing bearings. These sources can only help you place pins.

### Deriving the facing bearing from coastline geometry

Feasible as a **one-off offline script** that fills in `facingDeg`, not as live server logic:

1. Find the coastline segments within a few hundred metres of the spot.
2. Average their direction over about 0.5–1 km to smooth out noise.
3. Take the perpendicular that points toward the water. OSM coastline ways have [land on the left and water on the right](https://wiki.openstreetmap.org/wiki/Tag:natural=coastline), so the seaward normal is the segment bearing + 90°.

Data: [OSM coastlines from osmdata.openstreetmap.de](https://osmdata.openstreetmap.de/data/coastlines.html) (Shapefile, ODbL; large) or [Natural Earth 10m coastline](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-coastline/) ([public domain](https://www.naturalearthdata.com/about/terms-of-use/), small but too coarse for coves and points).

Pitfalls:
- **Points and headlands:** the wave breaks along the side of the point, not straight out from the coastline next to it.
- **Coves, jetties and harbors:** the nearest segment can be a breakwater or a harbor wall.
- **Smoothing length:** a short window gives noisy bearings; a long one hides the local bend.
- **The facing bearing isn't the swell window.** Islands and capes far offshore block parts of the arc. Even a correct facing bearing only gives a first guess such as `facing ± 70°`.

Recommendation: use the script to **suggest** values, then check each one on a map by hand.

## 3. Scoring approach

Keep it rules-based and explainable: every rating should list its reasons ("SSW 16 s in window, 2–3 ft, light offshore, mid tide"). Each factor gives **good / fair / poor**. Two factors act as gates:

1. **Gates.** If the swell direction is outside the window, or the size is below the spot's minimum, the rating is **Poor**, with no further checks.
2. **Combine.** Score swell match, period, size, wind and tide at 0–2 each. The overall rating is the **lowest** factor, optionally lifted one step if most other factors are good. Using the minimum matches how surfers think: one bad factor (onshore wind) ruins an otherwise good day.
3. **Output:** `{ rating: "poor"|"fair"|"good", reasons: string[] }` per spot per hour. That fits the existing hourly `TideLevel` and the planned `WindForecast` timeline.

**Offshore buoys versus nearshore models.** A buoy (or the 0.5° WW3 cell) measures open-ocean swell. What reaches a beach has been **refracted** (bent toward shallow water) and **shadowed** (blocked by islands and headlands), and both depend on direction and period. In Southern California, the Channel Islands block some swell directions entirely, so comparing raw buoy direction with a spot window can be badly wrong in sheltered places.

- **[CDIP MOP](https://cdip.ucsd.edu/documents/index/product_docs/mops/mop_intro.html)** (California only) already models island shadowing and refraction. Its points are about 100 m apart at 10 m depth. Where it covers a spot, prefer it to the buoy and loosen the swell-window rule, because the shadowing is already included.
- **[NOAA NWPS](https://polar.ncep.noaa.gov/nwps/)** (SWAN model nested in WAVEWATCH III, about 0.5–1.8 km near shore) covers U.S. forecast offices, but is distributed as GRIB. buoy-swell-data.md rated GRIB as high effort, so treat NWPS as a "later" option.

## 4. Map visualization options

| Option | Effort | Notes |
|---|---|---|
| Colored markers (green/yellow/red/grey) with a popup showing the reasons | **Low** | Gives most of the value. Grey means no data. Add a text label or shape so the map doesn't rely on color alone |
| Arrows for the current swell and wind direction | Low–medium | One rotated icon per spot, or one per buoy and forecast point. Remember that directions are "from" |
| Facing wedge or swell-window arc per spot | Medium | Polygon fan from `swellWindowMin` to `Max`, with the current swell arrow drawn over it. Good for learning and debugging the data |
| Time slider over the forecast week | Medium | Ratings are precomputed per hour, so the slider only recolors markers. Pairs well with the existing tide chart (show a cursor line) |
| Clustering | Low (library) | Only needed past about 50 spots: [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) (MIT), or MapLibre's [built-in GeoJSON clustering](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/) |

## 5. Suggested phased path

1. **Spots table, no scoring.** A `spots.json` with 5–10 hand-checked spots near the test zips, served by `GET /api/spots?zip=`, and shown as plain markers. This settles the data model.
2. **Wind-only rating.** Add the NWS wind forecast (wind-data.md §9) and label each spot offshore, cross or onshore by hour. This is the smallest real "is it working" signal.
3. **Swell gate and size.** Add the `.spec` buoy reading (buoy-swell-data.md §8), with a per-spot `buoyId`. Apply the window gate and the period/size rules, and return `reasons[]`.
4. **Tide and the time slider.** Score the tide band hourly and add the slider.
5. **Later:** CDIP MOP for California spots, swell-window wedges, the coastline-derived bearing script, and clustering.

### Decisions the developer must make

- **Spots: yes or no?** Everything beyond zip-level tides needs per-spot geometry, so a "spots" concept is effectively required. The remaining choice is between a JSON file and a database.
- **Who decides a spot's window and ideal tide?** Hand-entered values (accurate, slow) or derived ones (fast, often wrong).
- **Rating scale:** a 3-level scale (poor/fair/good) is recommended over a numeric score, because it's easier to explain and test.
- **Observed versus forecast:** "now" from buoys, or hourly from forecasts? The time slider needs forecasts, which means NWS gridpoints or WW3, both coarser than buoys.
- **License stance:** if spot data comes from OSM, attribution and ODbL share-alike apply. Wikidata (CC0) and Natural Earth (public domain) don't need attribution.
