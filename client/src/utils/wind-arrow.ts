// Sizes the map's wind arrow: length from the sustained speed, thickness from the gusts.
// Both are clamped so calm wind still shows a visible arrow and a storm doesn't cover the map.

const MIN_LENGTH_PX = 36;
const MAX_LENGTH_PX = 90;
const MAX_SPEED_MPH = 30; // at or above this, the arrow is full length

const MIN_STROKE_PX = 1;
const MAX_STROKE_PX = 6;
const MAX_GUST_MPH = 40; // at or above this, the arrow is full thickness

export interface WindArrowSize {
    length: number; // tail to tip, px
    stroke: number; // shaft thickness, px
    headLength: number; // px
    headWidth: number; // px; also the SVG's overall width
}

// Maps `value` from 0..max onto min..maxOut, clamping values outside 0..max.
function scale(value: number, max: number, min: number, maxOut: number): number {
    const fraction = Math.min(Math.max(value / max, 0), 1);
    return min + fraction * (maxOut - min);
}

export function windArrowSize(speedMph: number | null, gustMph: number | null): WindArrowSize {
    const length = scale(speedMph ?? 0, MAX_SPEED_MPH, MIN_LENGTH_PX, MAX_LENGTH_PX);
    // No gust value: size by the sustained speed, which is the least a gust can be.
    const stroke = scale(gustMph ?? speedMph ?? 0, MAX_GUST_MPH, MIN_STROKE_PX, MAX_STROKE_PX);
    // The head grows with the shaft, so a thick arrow doesn't end in a tiny point.
    const headWidth = 10 + stroke * 2;
    const headLength = 10 + stroke * 1.5;

    return { length, stroke, headLength, headWidth };
}
