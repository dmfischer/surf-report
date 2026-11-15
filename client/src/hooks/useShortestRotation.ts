import { useState } from "react";
import { shortestTurn } from "../utils/direction";

// Turns a target angle (or null) into a CSS rotation that always takes the short way round.
// CSS animates rotate(350deg) -> rotate(10deg) backwards through 180°, so instead of jumping to
// the target we keep a running total and add the shortest turn: 350 -> 370, which shows as 10°.
// While target is null, the last rotation is kept.
export function useShortestRotation(target: number | null): number {
    const [rotation, setRotation] = useState(target ?? 0);
    const [previousTarget, setPreviousTarget] = useState(target);

    // Updating state while rendering is React's recommended way to react to a prop change
    // ("storing information from previous renders"). The `if` stops it from looping:
    // React re-renders straight away, and then the targets match.
    if (target !== previousTarget) {
        setPreviousTarget(target);
        if (target !== null) {
            setRotation(rotation + shortestTurn(rotation, target));
        }
    }

    return rotation;
}
