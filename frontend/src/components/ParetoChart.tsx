import {
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    Tooltip,
    ResponsiveContainer,
    Line,
    ComposedChart,
    Cell,
} from 'recharts';
import { main } from "../../wailsjs/go/models";
import { formatCost, getIndividualKey } from "../utils/solutions";

interface Props {
    population: main.Individual[];
    selectedSolutionKey?: string | null;
    recommendedSolutionKey?: string | null;
}

export default function ParetoChart({
    population,
    selectedSolutionKey,
    recommendedSolutionKey,
}: Props) {

    const validData = population
        .filter(individual => individual.fitness > 0)
        .map((individual, index) => ({
            key: getIndividualKey(individual),
            x: individual.totalCost,
            y: individual.fitness,
            isPareto: individual.isPareto,
            sensors: individual.sensors.length,
            id: index,
        }));

    const paretoLine = validData
        .filter(p => p.isPareto)
        .sort((a, b) => a.x - b.x);

    const kneePoint = paretoLine.reduce((best, point) => {
        const score = point.y / (point.x + 1);
        const bestScore = best ? best.y / (best.x + 1) : -1;
        return score > bestScore ? point : best;
    }, null as any);

    const computeDensity = (p: any) => {
        let count = 0;
        for (const q of validData) {
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            if (Math.sqrt(dx * dx + dy * dy) < 200000) {
                count++;
            }
        }
        return count;
    };

    const enrichedData = validData.map(p => ({
        ...p,
        density: computeDensity(p),
    }));

    const maxDensity = enrichedData.length > 0
        ? Math.max(...enrichedData.map(p => p.density))
        : 1;

    const selectedPoint = enrichedData.find(point => point.key === selectedSolutionKey) || null;
    const recommendedPoint = enrichedData.find(point => point.key === recommendedSolutionKey) || null;

    return (
        <div className="h-72 w-full bg-slate-900/50 p-2 rounded-xl border border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>

                    <XAxis
                        dataKey="x"
                        type="number"
                        stroke="#64748b"
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                        fontSize={10}
                    />
                    <YAxis
                        dataKey="y"
                        type="number"
                        domain={[0, 100]}
                        stroke="#64748b"
                        fontSize={10}
                    />

                    <ZAxis range={[40, 40]} />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #1e293b',
                            borderRadius: 8,
                            fontSize: 11,
                        }}
                        formatter={(value: any, name: any) => {
                            if (name === "x") return [formatCost(value), "Coût"];
                            if (name === "y") return [`${value.toFixed(2)}%`, "Couverture"];
                            if (name === "sensors") return [value, "Capteurs"];
                            return [value, name];
                        }}
                    />

                    <Scatter name="Solutions" data={enrichedData}>
                        {enrichedData.map((entry, index) => {
                            const intensity = entry.density / maxDensity;
                            let color = entry.isPareto
                                ? `rgba(16,185,129,${0.3 + intensity * 0.7})`
                                : `rgba(100,116,139,0.25)`;

                            if (entry.key === recommendedSolutionKey) {
                                color = 'rgba(245, 158, 11, 0.95)';
                            }
                            if (entry.key === selectedSolutionKey) {
                                color = 'rgba(59, 130, 246, 0.95)';
                            }

                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={color}
                                />
                            );
                        })}
                    </Scatter>

                    <Line
                        type="monotone"
                        data={paretoLine}
                        dataKey="y"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />

                    {kneePoint && (
                        <Scatter
                            data={[kneePoint]}
                            fill="#f59e0b"
                        />
                    )}

                    {recommendedPoint && (
                        <Scatter
                            data={[recommendedPoint]}
                            fill="#f59e0b"
                        />
                    )}

                    {selectedPoint && (
                        <Scatter
                            data={[selectedPoint]}
                            fill="#3b82f6"
                        />
                    )}

                </ComposedChart>
            </ResponsiveContainer>

            <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-2">
                <span>🟢 Pareto optimal</span>
                <span>🟡 Recommandee ADOMC</span>
                <span>🔵 Selectionnee</span>
            </div>
        </div>
    );
}
