import { Map, Marker, NavigationControl } from "@vis.gl/react-maplibre";
// MapLibre positions its canvas, controls and markers with this stylesheet;
// without it the map renders but markers and attribution end up in the wrong place.
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng, WindForecast } from "../types/conditions";
import { toCompass } from "../utils/direction";
import { useShortestRotation } from "../hooks/useShortestRotation";

// Free vector tiles from OpenFreeMap: no API key or account needed.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export interface StationMapProps {
    zipCode: string;
    zipLocation: LatLng;
    stationName: string;
    stationLocation: LatLng;
    // Wind to draw at the zip location; undefined hides the arrow (no forecast for that hour).
    wind: WindForecast | undefined;
    // true when `wind` is the current hour rather than a time hovered on the tide chart.
    isCurrentWind: boolean;
    // IANA zone of the station, used to show the wind's time.
    timeZone: string;
}

function StationMap({ zipCode, zipLocation, stationName, stationLocation, wind, isCurrentWind, timeZone }: StationMapProps) {
    // The smallest box containing both points, as [[west, south], [east, north]].
    // MapLibre (like GeoJSON) orders coordinates as [lng, lat], the reverse of how we usually say them.
    const bounds: [[number, number], [number, number]] = [
        [Math.min(zipLocation.lng, stationLocation.lng), Math.min(zipLocation.lat, stationLocation.lat)],
        [Math.max(zipLocation.lng, stationLocation.lng), Math.max(zipLocation.lat, stationLocation.lat)],
    ];

    // directionDeg is where the wind comes FROM. Weather maps point arrows the way the wind
    // is blowing, so turn it around: a west wind (270°) blows toward the east (90°).
    const direction = wind?.directionDeg ?? null;
    const arrowRotation = direction === null ? null : (direction + 180) % 360;
    const smoothRotation = useShortestRotation(arrowRotation);

    const timeFormat = new Intl.DateTimeFormat("en-US", {
        timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const windWhen = isCurrentWind ? "now" : wind ? timeFormat.format(Date.parse(wind.time)) : "";
    let windCaption = "No wind forecast for this hour";
    if (wind && wind.speedMph !== null) {
        const from = direction === null ? "" : ` from ${toCompass(direction)} (${direction}°)`;
        const gusts = wind.gustMph === null ? "" : `, gusts ${wind.gustMph} mph`;
        windCaption = `Wind ${windWhen}: ${wind.speedMph} mph${from}${gusts}`;
    }

    return (
        <div className="station-map">
            <Map
                // initialViewState is only read when the map first mounts. ConditionsReport
                // gives this component a `key`, so a new search creates a fresh map that zooms to the new points.
                initialViewState={{
                    bounds,
                    // padding keeps the dots away from the edges; maxZoom stops it zooming
                    // in to street level when the two points are very close together.
                    fitBoundsOptions: { padding: 60, maxZoom: 12 },
                }}
                mapStyle={MAP_STYLE_URL}
                style={{ width: "100%", height: 360 }}
            >
                <NavigationControl position="top-right" showCompass={false} />
                {/* zIndex: markers otherwise stack in the order they were added, and this one comes
                    and goes, so it could end up on top. The dots (2) always cover the arrow's tail (1). */}
                {arrowRotation !== null && (
                    <Marker longitude={zipLocation.lng} latitude={zipLocation.lat} anchor="bottom" style={{ zIndex: 1 }}>
                        {/* The SVG points north (up); CSS rotates it clockwise (see useShortestRotation). */}
                        <svg
                            className="wind-arrow"
                            viewBox="0 0 24 56"
                            style={{ transform: `rotate(${smoothRotation}deg)` }}
                            aria-label={windCaption}
                        >
                            <title>{windCaption}</title>
                            <line x1="12" y1="56" x2="12" y2="10" />
                            <polygon points="12,2 21,16 3,16" />
                        </svg>
                    </Marker>
                )}
                <Marker longitude={zipLocation.lng} latitude={zipLocation.lat} style={{ zIndex: 2 }}>
                    <div className="map-dot map-dot--zip" title={`Zip code ${zipCode}`} />
                </Marker>
                <Marker longitude={stationLocation.lng} latitude={stationLocation.lat} style={{ zIndex: 2 }}>
                    <div className="map-dot map-dot--station" title={`Tide station: ${stationName}`} />
                </Marker>
            </Map>
            <ul className="map-legend">
                <li><span className="map-dot map-dot--zip" /> Zip code {zipCode}</li>
                <li><span className="map-dot map-dot--station" /> Tide station</li>
            </ul>
            {/* aria-live: screen readers announce the new wind as the chart is hovered. */}
            <p className="wind-caption" aria-live="polite">{windCaption}</p>
        </div>
    );
}

export default StationMap
