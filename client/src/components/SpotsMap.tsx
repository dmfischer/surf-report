import { Map, Marker, NavigationControl } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng, WindForecast } from "../types/conditions";
import type { SpotNearby } from "../types/spots";
import { toCompass } from "../utils/direction";
import { describeWind } from "../utils/wind-caption";
import WindArrowMarker from "./WindArrowMarker";

// Same free OpenFreeMap tiles as StationMap.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export interface SpotsMapProps {
    zipCode: string;
    zipLocation: LatLng;
    spots: SpotNearby[];
    // id of the selected spot, or null if none is selected yet.
    selectedSpotId: string | null;
    // Called with a spot's id when the user picks it (on the map or in the list).
    onSelect: (spotId: string) => void;
    // Wind at the selected spot, drawn as an arrow there with a caption under the map.
    // Leave `wind` out (or undefined) while no spot's conditions are loaded.
    wind?: WindForecast | undefined;
    // true when `wind` is the current hour rather than a time hovered on the tide chart.
    isCurrentWind?: boolean;
    // IANA zone used to show the wind's time.
    timeZone?: string;
}

// Shows the surf spots near a zip code and lets the user pick one.
// The parent (ConditionsReport) owns which spot is selected; this component only reports clicks.
function SpotsMap({
    zipCode, zipLocation, spots, selectedSpotId, onSelect, wind, isCurrentWind = true, timeZone = "UTC",
}: SpotsMapProps) {
    const selectedSpot = spots.find((spot) => spot.id === selectedSpotId);
    const windCaption = selectedSpot ? describeWind(wind, isCurrentWind, timeZone) : null;
    const points = [zipLocation, ...spots];
    const lngs = points.map((point) => point.lng);
    const lats = points.map((point) => point.lat);
    const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
    ];

    return (
        <div className="spots-map">
            <Map
                initialViewState={{ bounds, fitBoundsOptions: { padding: 60, maxZoom: 13 } }}
                mapStyle={MAP_STYLE_URL}
                style={{ width: "100%", height: 400 }}
            >
                <NavigationControl position="top-right" showCompass={false} />
                {selectedSpot && windCaption && (
                    // key: a different spot gets a fresh arrow, rather than one that swings across from the last spot.
                    <WindArrowMarker key={selectedSpot.id} location={selectedSpot} wind={wind} label={windCaption} />
                )}
                <Marker longitude={zipLocation.lng} latitude={zipLocation.lat} style={{ zIndex: 2 }}>
                    <div className="map-dot map-dot--zip" title={`Zip code ${zipCode}`} />
                </Marker>
                {spots.map((spot) => {
                    const isSelected = spot.id === selectedSpotId;
                    return (
                        // key: React needs a stable, unique key for each item in a list it renders,
                        // so it can tell which marker is which when the list changes.
                        <Marker
                            key={spot.id}
                            longitude={spot.lng}
                            latitude={spot.lat}
                            // Above the zip dot and the wind arrow; the selected pin above the others.
                            style={{ zIndex: isSelected ? 4 : 3 }}
                        >
                            {/* A real <button>, so the pin works with the keyboard and screen readers too. */}
                            {/* The selected spot shrinks to a dot with no visible name, so its label doesn't
                                cover the wind arrow (the name is in the heading above the map).
                                aria-label keeps the name for screen readers, and title shows it on hover. */}
                            <button
                                type="button"
                                className={`spot-pin${isSelected ? " spot-pin--selected" : ""}`}
                                aria-pressed={isSelected}
                                aria-label={isSelected ? spot.name : undefined}
                                title={isSelected ? spot.name : undefined}
                                onClick={() => onSelect(spot.id)}
                            >
                                {isSelected ? null : spot.name}
                            </button>
                        </Marker>
                    );
                })}
            </Map>
            {/* aria-live: screen readers announce the new wind as the chart is hovered. */}
            {windCaption && <p className="wind-caption" aria-live="polite">{windCaption}</p>}

            {/* The same choices as a list: easier on small screens and shows the details. */}
            <ul className="spot-list">
                {spots.map((spot) => (
                    <li key={spot.id}>
                        <button
                            type="button"
                            className={`spot-list-item${spot.id === selectedSpotId ? " spot-list-item--selected" : ""}`}
                            aria-pressed={spot.id === selectedSpotId}
                            onClick={() => onSelect(spot.id)}
                        >
                            <span className="spot-list-name">{spot.name}</span>
                            <span className="spot-list-details">
                                {spot.breakType} break · faces {toCompass(spot.facingDeg)} · {spot.distanceMiles} mi
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default SpotsMap
