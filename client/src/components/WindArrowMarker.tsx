import { Marker } from "@vis.gl/react-maplibre";
import type { LatLng, WindForecast } from "../types/conditions";
import { useShortestRotation } from "../hooks/useShortestRotation";
import { windArrowSize } from "../utils/wind-arrow";

export interface WindArrowMarkerProps {
    // Where the arrow starts (its tail).
    location: LatLng;
    // undefined, or no direction, hides the arrow.
    wind: WindForecast | undefined;
    // Text for screen readers and the hover tooltip, e.g. from describeWind.
    label: string;
}

// A wind arrow on a MapLibre map, used by StationMap (zip report) and SpotsMap (selected spot).
// Must be rendered inside a <Map>.
function WindArrowMarker({ location, wind, label }: WindArrowMarkerProps) {
    // directionDeg is where the wind comes FROM. Weather maps point arrows the way the wind
    // is blowing, so turn it around: a west wind (270°) blows toward the east (90°).
    const direction = wind?.directionDeg ?? null;
    const arrowRotation = direction === null ? null : (direction + 180) % 360;
    // Hooks run on every render, before any early return (a rule of hooks).
    const smoothRotation = useShortestRotation(arrowRotation);

    if (arrowRotation === null) {
        return null;
    }

    const arrow = windArrowSize(wind?.speedMph ?? null, wind?.gustMph ?? null);
    const centerX = arrow.headWidth / 2;

    return (
        // zIndex 1: markers otherwise stack in the order they were added, and this one comes and goes,
        // so it could end up on top. Dots and pins use 2 or more, so they cover the arrow's tail.
        <Marker longitude={location.lng} latitude={location.lat} anchor="bottom" style={{ zIndex: 1 }}>
            {/* Drawn in pixels (viewBox = width x height), pointing north (up) with the tail at the bottom
                center; CSS rotates it clockwise. Length follows the speed, thickness the gusts. */}
            <svg
                className="wind-arrow"
                width={arrow.headWidth}
                height={arrow.length}
                viewBox={`0 0 ${arrow.headWidth} ${arrow.length}`}
                style={{ transform: `rotate(${smoothRotation}deg)` }}
                aria-label={label}
            >
                <title>{label}</title>
                <line x1={centerX} y1={arrow.length} x2={centerX} y2={arrow.headLength} strokeWidth={arrow.stroke} />
                <polygon points={`${centerX},0 ${arrow.headWidth},${arrow.headLength} 0,${arrow.headLength}`} />
            </svg>
        </Marker>
    );
}

export default WindArrowMarker
