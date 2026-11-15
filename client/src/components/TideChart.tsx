import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TideLevel } from "../types/conditions";
import type { RatingBand } from "../utils/rating-bands";

export interface TideChartProps {
    tideLevels: TideLevel[];
    // IANA zone of the station, e.g. "America/New_York". Times are shown in it.
    timeZone: string;
    // Called with the hovered point's timestamp (ms since 1970) as the cursor moves,
    // and with null when the cursor leaves the chart.
    onHoverTimeChange?: (timestamp: number | null) => void;
    // Optional coloured background bands (good / fair / poor) behind the tide curve.
    ratingBands?: RatingBand[];
}

function TideChart({ tideLevels, timeZone, onHoverTimeChange, ratingBands = [] }: TideChartProps) {
    // Recharts can only space points by time if time is a number, so turn
    // each ISO string into milliseconds since 1970 (a "timestamp").
    const data = tideLevels.map((level) => ({
        timestamp: Date.parse(level.time),
        height: level.height,
    }));

    // Formatters that display a timestamp in the station's time zone.
    const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" });
    const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "numeric", day: "numeric" });
    const fullFormat = new Intl.DateTimeFormat("en-US", {
        timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });

    // One tick per day, at the station's local midnight.
    const midnights = data
        .map((point) => point.timestamp)
        .filter((timestamp) => Number(hourFormat.format(timestamp)) === 0);

    return (
        <div className="tide-chart">
            <ResponsiveContainer width="100%" height={320}>
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 40, bottom: 0, left: 0 }}
                    // Recharts tells us which data point is under the cursor (the same one the
                    // tooltip shows) as an index into `data`; we pass that point's time up.
                    onMouseMove={(state) => {
                        const point = data[Number(state.activeTooltipIndex)];
                        onHoverTimeChange?.(state.isTooltipActive && point ? point.timestamp : null);
                    }}
                    onMouseLeave={() => onHoverTimeChange?.(null)}
                >
                    <defs>
                        {/* Fill under the curve fades from the accent colour to transparent. */}
                        <linearGradient id="tide-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.35 }} />
                            <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
                        </linearGradient>
                    </defs>
                    {/* Drawn first, so they sit behind the grid and the tide curve. No y1/y2 means the full
                        height. ifOverflow="hidden" clips the last band, which ends an hour after the data. */}
                    {ratingBands.map((band) => (
                        <ReferenceArea
                            key={band.start}
                            x1={band.start}
                            x2={band.end}
                            ifOverflow="hidden"
                            className={`rating-band rating-band--${band.rating}`}
                        />
                    ))}
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        ticks={midnights}
                        // Show every midnight. By default Recharts nudges the last
                        // label inside the axis and hides any label it then overlaps.
                        interval={0}
                        tickFormatter={(timestamp: number) => dayFormat.format(timestamp)}
                    />
                    <YAxis unit=" ft" width={60} />
                    <Tooltip
                        labelFormatter={(timestamp) => fullFormat.format(timestamp as number)}
                        formatter={(height) => [`${height} ft`, "Height"]}
                        contentStyle={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            boxShadow: "var(--shadow)",
                        }}
                        labelStyle={{ color: "var(--text-h)", fontWeight: 600 }}
                        itemStyle={{ color: "var(--accent)" }}
                    />
                    <Area type="monotone" dataKey="height" strokeWidth={2} fill="url(#tide-fill)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default TideChart
