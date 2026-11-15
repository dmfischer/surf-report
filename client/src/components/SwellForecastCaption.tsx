import type { SwellForecast, WaveComponent } from "../types/conditions";
import { toCompass } from "../utils/direction";

export interface SwellForecastCaptionProps {
    // The forecast hour to show; undefined if the forecast doesn't cover it.
    forecast: SwellForecast | undefined;
    // true when `forecast` is the current hour rather than a time hovered on the tide chart.
    isCurrent: boolean;
    // IANA zone of the station, used to show the forecast's time.
    timeZone: string;
}

// "5.3 ft @ 12 s from W (278°)". Periods are rounded: the model's decimals (13.05 s) are false precision.
function describe(component: WaveComponent): string {
    const period = component.periodS === null ? "" : ` @ ${Math.round(component.periodS)} s`;
    const direction = component.directionDeg === null
        ? ""
        : ` from ${toCompass(component.directionDeg)} (${Math.round(component.directionDeg)}°)`;
    return `${component.heightFt} ft${period}${direction}`;
}

// The forecast swell for the hovered hour (or now), plus the credit Open-Meteo's licence (CC BY 4.0) requires.
function SwellForecastCaption({ forecast, isCurrent, timeZone }: SwellForecastCaptionProps) {
    let text = "No swell forecast for this hour";
    if (forecast) {
        const timeFormat = new Intl.DateTimeFormat("en-US", {
            timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
        const when = isCurrent ? "now" : timeFormat.format(Date.parse(forecast.time));
        // Skip components the model has as (almost) nothing, e.g. 0 ft of wind chop on a calm day.
        const swells = [forecast.primarySwell, forecast.secondarySwell]
            .filter((swell): swell is WaveComponent => swell !== null && swell.heightFt > 0)
            .map(describe);
        const chop = forecast.windWaves && forecast.windWaves.heightFt > 0 ? ` · wind waves ${describe(forecast.windWaves)}` : "";
        text = `Swell forecast ${when}: ${swells.length > 0 ? swells.join(" + ") : "no swell"}${chop}`;
    }

    return (
        <div className="swell-forecast">
            {/* aria-live: screen readers announce the new forecast as the chart is hovered. */}
            <p className="swell-caption" aria-live="polite">{text}</p>
            <p className="attribution">
                Swell forecast: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0)
            </p>
        </div>
    );
}

export default SwellForecastCaption
