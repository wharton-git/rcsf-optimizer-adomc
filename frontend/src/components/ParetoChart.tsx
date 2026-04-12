import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, Cell } from 'recharts';
import { main } from "../../wailsjs/go/models";

interface Props {
    population: main.Individual[];
}

export default function ParetoChart({ population }: Props) {
    // 1. Filtrer pour ne garder que les solutions valides (Fitness > 0)
    // Cela évite d'écraser l'échelle du graph avec les individus rejetés
    const validData = population
        .filter(ind => ind.fitness > 0)
        .map((ind, index) => ({
            x: ind.totalCost,
            y: ind.fitness,
            isPareto: ind.isPareto,
            id: index
        }));

    // 2. Extraire et trier le front de Pareto pour la ligne bleue
    const paretoLine = validData
        .filter(p => p.isPareto)
        .sort((a, b) => a.x - b.x);

    // Formateur pour le coût (ex: 1 500 000 Ar)
    const formatCost = (value: number) => {
        return `${value.toLocaleString()} Ar`;
    };

    return (
        <div className="h-64 w-full bg-slate-900/50 p-2 rounded-xl border border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                    <XAxis
                        dataKey="x"
                        name="Coût"
                        type="number"
                        stroke="#475569"
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(val) => `${val / 1000}k`} // Affiche en "k" pour gagner de la place
                    />
                    <YAxis
                        dataKey="y"
                        name="Couverture"
                        unit="%"
                        type="number"
                        domain={[0, 100]}
                        stroke="#475569"
                        fontSize={10}
                        tickLine={false}
                    />
                    <ZAxis range={[20, 21]} />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px', borderRadius: '8px' }}
                        formatter={(value: any, name: any) => {
                            if (typeof value === 'number') {
                                if (name === "x") {
                                    return [formatCost(value), "Coût"];
                                }
                                if (name === "y") {
                                    return [`${value.toFixed(2)}%`, "Couverture"];
                                }
                            }
                            return [value, name];
                        }}
                    />

                    {/* Population Globale : Points grisés pour les solutions dominées */}
                    <Scatter name="Solutions" data={validData}>
                        {validData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.isPareto ? '#10b981' : '#475569'} // Vert pour Pareto, gris pour le reste
                                fillOpacity={entry.isPareto ? 1 : 0.3}
                            />
                        ))}
                    </Scatter>

                    {/* Ligne du Front de Pareto : La frontière de l'optimalité */}
                    <Line
                        type="monotone" // "stepAfter" est souvent plus réaliste pour du Pareto discret
                        data={paretoLine}
                        dataKey="y"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}