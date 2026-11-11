import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { TideLevel } from "../types/conditions";

export interface TideChartProps {
    tideLevels: TideLevel[];
    // IANA zone of the station, e.g. "America/New_York". Times are shown in it.
    timeZone: string;
}

function TideChart({ tideLevels, timeZone }: TideChartProps) {
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
        <>
            <LineChart width={800} height={300} data={data} margin={{ top: 5, right: 50, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
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
                <YAxis />
                <Tooltip
                    labelFormatter={(timestamp) => fullFormat.format(timestamp as number)}
                    formatter={(height) => [`${height} ft`, "Height"]}
                />
                <Line type="monotone" dataKey="height" dot={false} />
            </LineChart>
        </>
    );
}

export default TideChart
