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

interface Props {
    population: main.Individual[];
}

export default function ParetoChart({ population }: Props) {

    //  Filtrer solutions valides
    const validData = population
        .filter(ind => ind.fitness > 0)
        .map((ind, index) => ({
            x: ind.totalCost,
            y: ind.fitness,
            isPareto: ind.isPareto,
            sensors: ind.sensors.length,
            id: index,
        }));

    //  Pareto front trié
    const paretoLine = validData
        .filter(p => p.isPareto)
        .sort((a, b) => a.x - b.x);

    //  KNEE POINT (meilleur compromis)
    const kneePoint = paretoLine.reduce((best, point) => {
        const score = point.y / (point.x + 1); // ratio efficacité/coût
        const bestScore = best ? best.y / (best.x + 1) : -1;
        return score > bestScore ? point : best;
    }, null as any);

    //  DENSITÉ LOCALE (simple clustering)
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

    const formatCost = (v: number) => `${v.toLocaleString()} Ar`;

    return (
        <div className="h-72 w-full bg-slate-900/50 p-2 rounded-xl border border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>

                    {/* AXES */}
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

                    {/* TOOLTIP AVANCÉ */}
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #1e293b',
                            borderRadius: 8,
                            fontSize: 11,
                        }}
                        formatter={(value: any, name: any, props: any) => {
                            if (name === "x") return [formatCost(value), "Coût"];
                            if (name === "y") return [`${value.toFixed(2)}%`, "Couverture"];
                            if (name === "sensors") return [value, "Capteurs"];
                            return [value, name];
                        }}
                    />

                    {/*  SCATTER AVEC DENSITÉ VISUELLE */}
                    <Scatter name="Solutions" data={enrichedData}>
                        {enrichedData.map((entry, index) => {
                            const intensity = entry.density / maxDensity;

                            // gradient vert → rouge selon densité
                            const color = entry.isPareto
                                ? `rgba(16,185,129,${0.3 + intensity * 0.7})`
                                : `rgba(100,116,139,0.25)`;

                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={color}
                                />
                            );
                        })}
                    </Scatter>

                    {/*  FRONT PARETO LISSE */}
                    <Line
                        type="monotone"
                        data={paretoLine}
                        dataKey="y"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />

                    {/*  KNEE POINT (meilleur compromis) */}
                    {kneePoint && (
                        <Scatter
                            data={[kneePoint]}
                            fill="#f59e0b"
                        />
                    )}

                </ComposedChart>
            </ResponsiveContainer>

            {/*  LÉGENDE */}
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-2">
                <span>🟢 Pareto optimal</span>
                <span>🟡 Meilleur compromis</span>
                <span>🔵 Densité des solutions</span>
            </div>
        </div>
    );
}
