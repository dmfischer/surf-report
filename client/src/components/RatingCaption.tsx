import type { HourRating, Rating } from "../types/spots";

const LABELS: Record<Rating, string> = { good: "Good", fair: "Fair", poor: "Poor" };

export interface RatingCaptionProps {
    // The rating for the hovered hour (or now); undefined if there isn't one.
    rating: HourRating | undefined;
    // true when `rating` is the current hour rather than a time hovered on the tide chart.
    isCurrent: boolean;
    timeZone: string;
}

// The rating for one hour in words, with its reasons, plus a key to the chart's colours.
// Words as well as colours, so the rating doesn't depend on telling green from red.
function RatingCaption({ rating, isCurrent, timeZone }: RatingCaptionProps) {
    const timeFormat = new Intl.DateTimeFormat("en-US", {
        timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });

    return (
        <div className="rating-caption">
            {rating ? (
                <p aria-live="polite">
                    <span className={`rating-chip rating-chip--${rating.rating}`}>{LABELS[rating.rating]}</span>{" "}
                    {isCurrent ? "now" : timeFormat.format(Date.parse(rating.time))}: {rating.reasons.join(" · ")}
                </p>
            ) : (
                <p>No rating for this hour</p>
            )}
            <ul className="rating-key" aria-label="Chart colours">
                {(["good", "fair", "poor"] as const).map((key) => (
                    <li key={key}>
                        <span className={`rating-swatch rating-swatch--${key}`} /> {LABELS[key]}
                    </li>
                ))}
                <li className="rating-key-note">Swell and wind only; tide isn't rated yet</li>
            </ul>
        </div>
    );
}

export default RatingCaption
