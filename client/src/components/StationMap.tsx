import { Map, Marker, NavigationControl } from "@vis.gl/react-maplibre";
// MapLibre positions its canvas, controls and markers with this stylesheet;
// without it the map renders but markers and attribution end up in the wrong place.
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "../types/conditions";

// Free vector tiles from OpenFreeMap: no API key or account needed.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export interface StationMapProps {
    zipCode: string;
    zipLocation: LatLng;
    stationName: string;
    stationLocation: LatLng;
}

function StationMap({ zipCode, zipLocation, stationName, stationLocation }: StationMapProps) {
    // The smallest box containing both points, as [[west, south], [east, north]].
    // MapLibre (like GeoJSON) orders coordinates as [lng, lat], the reverse of how we usually say them.
    const bounds: [[number, number], [number, number]] = [
        [Math.min(zipLocation.lng, stationLocation.lng), Math.min(zipLocation.lat, stationLocation.lat)],
        [Math.max(zipLocation.lng, stationLocation.lng), Math.max(zipLocation.lat, stationLocation.lat)],
    ];

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
                <Marker longitude={zipLocation.lng} latitude={zipLocation.lat}>
                    <div className="map-dot map-dot--zip" title={`Zip code ${zipCode}`} />
                </Marker>
                <Marker longitude={stationLocation.lng} latitude={stationLocation.lat}>
                    <div className="map-dot map-dot--station" title={`Tide station: ${stationName}`} />
                </Marker>
            </Map>
            <ul className="map-legend">
                <li><span className="map-dot map-dot--zip" /> Zip code {zipCode}</li>
                <li><span className="map-dot map-dot--station" /> Tide station</li>
            </ul>
        </div>
    );
}

export default StationMap
