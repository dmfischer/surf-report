import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { TideLevel } from "../types/conditions";

export interface TideChartProps {
    tideLevels: TideLevel[];
}

function TideChart({ tideLevels }: TideChartProps) {

    return (
        <>
            <LineChart width={800} height={300} data={tideLevels}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="height" dot={false} />
            </LineChart>
        </>
    );
}

export default TideChart