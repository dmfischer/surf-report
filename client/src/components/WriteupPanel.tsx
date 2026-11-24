import type { DayBlock, Writeup } from "../types/writeup";

const BLOCK_LABELS: Record<DayBlock, string> = {
    dawn: "Dawn", morning: "Morning", afternoon: "Afternoon", evening: "Evening",
};

// "2026-11-27" is a calendar date, not an instant. Reading it as noon UTC and formatting in UTC gives
// the same weekday everywhere; formatting it in the viewer's zone could shift it to the previous day.
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
// generatedAt *is* an instant, so it's shown in the viewer's own time zone.
const writtenFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

export interface WriteupPanelProps {
    region: string;
    generatedAt: string;
    writeup: Writeup;
    // Spot names by id, to label the best bets (the write-up only has ids).
    spotNames: Map<string, string>;
    // Picks a spot on the map, as if its pin had been clicked.
    onSelectSpot: (spotId: string) => void;
}

// The AI-generated weekly outlook for the region. Labelled as AI-generated and with the time it was
// written, because it's an outlook from data that keeps changing, not live conditions.
function WriteupPanel({ region, generatedAt, writeup, spotNames, onSelectSpot }: WriteupPanelProps) {
    return (
        <section className="card writeup" aria-labelledby="writeup-headline">
            <p className="writeup-label">
                AI-generated outlook · {region} · Written {writtenFormat.format(Date.parse(generatedAt))}
            </p>
            <h2 id="writeup-headline" className="writeup-headline">{writeup.headline}</h2>

            <ol className="writeup-days">
                {writeup.days.map((day) => (
                    <li key={day.date} className="writeup-day">
                        <h3 className="writeup-date">{dayFormat.format(Date.parse(`${day.date}T12:00:00Z`))}</h3>
                        <p className="writeup-summary">{day.summary}</p>
                        {day.bestBets.length > 0 && (
                            <ul className="writeup-bets" aria-label="Best bets">
                                {day.bestBets.map((bet) => (
                                    <li key={`${bet.spotId}-${bet.block}`}>
                                        {/* A button, so the best bet can be followed to that spot's chart and map. */}
                                        <button type="button" className="writeup-bet" onClick={() => onSelectSpot(bet.spotId)}>
                                            {spotNames.get(bet.spotId) ?? bet.spotId} · {BLOCK_LABELS[bet.block]}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ol>

            {writeup.caveats.length > 0 && (
                <ul className="writeup-caveats">
                    {writeup.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
            )}
            {/* Our own fixed wording, not the model's: it must always be there, whatever the model writes. */}
            <p className="writeup-disclaimer">
                Written by an AI from our forecast data and ratings. It can be wrong and isn't safety advice:
                check conditions yourself before you paddle out.
            </p>
        </section>
    );
}

export default WriteupPanel
