import { Map, Marker, NavigationControl } from "@vis.gl/react-maplibre";
// MapLibre positions its canvas, controls and markers with this stylesheet;
// without it the map renders but markers and attribution end up in the wrong place.
import "maplibre-gl/dist/maplibre-gl.css";
import type { Buoy, LatLng, WindForecast } from "../types/conditions";
import { describeWind } from "../utils/wind-caption";
import WindArrowMarker from "./WindArrowMarker";

// Free vector tiles from OpenFreeMap: no API key or account needed.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export interface StationMapProps {
    zipCode: string;
    zipLocation: LatLng;
    stationName: string;
    stationLocation: LatLng;
    // Nearest wave buoy, shown as its own dot; null if there's none nearby.
    buoy: Buoy | null;
    // Wind to draw at the zip location; undefined hides the arrow (no forecast for that hour).
    wind: WindForecast | undefined;
    // true when `wind` is the current hour rather than a time hovered on the tide chart.
    isCurrentWind: boolean;
    // IANA zone of the station, used to show the wind's time.
    timeZone: string;
}

function StationMap({
    zipCode, zipLocation, stationName, stationLocation, buoy, wind, isCurrentWind, timeZone,
}: StationMapProps) {
    // The smallest box containing all the points, as [[west, south], [east, north]].
    // MapLibre (like GeoJSON) orders coordinates as [lng, lat], the reverse of how we usually say them.
    const points = buoy ? [zipLocation, stationLocation, buoy] : [zipLocation, stationLocation];
    const lngs = points.map((point) => point.lng);
    const lats = points.map((point) => point.lat);
    const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
    ];

    const windCaption = describeWind(wind, isCurrentWind, timeZone);

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
                <WindArrowMarker location={zipLocation} wind={wind} label={windCaption} />
                <Marker longitude={zipLocation.lng} latitude={zipLocation.lat} style={{ zIndex: 2 }}>
                    <div className="map-dot map-dot--zip" title={`Zip code ${zipCode}`} />
                </Marker>
                <Marker longitude={stationLocation.lng} latitude={stationLocation.lat} style={{ zIndex: 2 }}>
                    <div className="map-dot map-dot--station" title={`Tide station: ${stationName}`} />
                </Marker>
                {buoy && (
                    <Marker longitude={buoy.lng} latitude={buoy.lat} style={{ zIndex: 2 }}>
                        <div className="map-dot map-dot--buoy" title={`Buoy ${buoy.id}: ${buoy.name}`} />
                    </Marker>
                )}
            </Map>
            <ul className="map-legend">
                <li><span className="map-dot map-dot--zip" /> Zip code {zipCode}</li>
                <li><span className="map-dot map-dot--station" /> Tide station</li>
                {buoy && <li><span className="map-dot map-dot--buoy" /> Buoy {buoy.id}</li>}
            </ul>
            {/* aria-live: screen readers announce the new wind as the chart is hovered. */}
            <p className="wind-caption" aria-live="polite">{windCaption}</p>
        </div>
    );
}

export default StationMap
