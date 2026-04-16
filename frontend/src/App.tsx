import { useEffect, useRef, useState } from 'react';
import {
    Evolve,
    GetAllSolutions,
    GetCatalog,
    GetConfig,
    GetOptimalSolutions,
    InitPopulation,
    SetConstraints,
    UpdateCatalog,
} from "../wailsjs/go/main/App";
import ParetoChart from './components/ParetoChart';
import { main } from "../wailsjs/go/models";

const DEFAULT_CONFIG: main.Config = {
    areaWidth: 80,
    areaHeight: 60,
    population: 50,
    maxBudget: 2000000,
};

const SOLUTION_COST_TOLERANCE = 50000;
const SOLUTION_FITNESS_TOLERANCE = 0.2;

const SENSOR_COLORS: Record<string, { bg: string, stroke: string, dot: string }> = {
    "Eco-A": { bg: 'rgba(34, 197, 94, 0.15)', stroke: 'rgba(34, 197, 94, 0.4)', dot: '#22c55e' },
    "Standard-B": { bg: 'rgba(59, 130, 246, 0.15)', stroke: 'rgba(59, 130, 246, 0.4)', dot: '#3b82f6' },
    "Premium-C": { bg: 'rgba(168, 85, 247, 0.15)', stroke: 'rgba(168, 85, 247, 0.4)', dot: '#a855f7' },
};

const formatMaterial = (sensors: main.Sensor[]) => {
    const counts: Record<string, number> = {};
    sensors.forEach(sensor => {
        counts[sensor.type] = (counts[sensor.type] || 0) + 1;
    });
    return counts;
};

const getMaterialSignature = (sensors: main.Sensor[]) => Object.entries(formatMaterial(sensors))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `${type}:${count}`)
    .join('|');

const getSolutionKey = (individual: main.Individual) =>
    `${Math.round(individual.totalCost)}-${individual.fitness.toFixed(3)}-${getMaterialSignature(individual.sensors)}`;

const getSolutionScore = (individual: main.Individual) => individual.fitness / (individual.totalCost + 1);

const areSolutionsSimilar = (left: main.Individual, right: main.Individual) => {
    if (left.sensors.length !== right.sensors.length) {
        return false;
    }

    if (getMaterialSignature(left.sensors) !== getMaterialSignature(right.sensors)) {
        return false;
    }

    return Math.abs(left.totalCost - right.totalCost) <= SOLUTION_COST_TOLERANCE &&
        Math.abs(left.fitness - right.fitness) <= SOLUTION_FITNESS_TOLERANCE;
};

const compareByFitnessThenCost = (left: main.Individual, right: main.Individual) => {
    if (Math.abs(left.fitness - right.fitness) > Number.EPSILON) {
        return right.fitness - left.fitness;
    }

    if (Math.abs(left.totalCost - right.totalCost) > Number.EPSILON) {
        return left.totalCost - right.totalCost;
    }

    return left.sensors.length - right.sensors.length;
};

const compareByScoreThenFitness = (left: main.Individual, right: main.Individual) => {
    const scoreDiff = getSolutionScore(right) - getSolutionScore(left);
    if (Math.abs(scoreDiff) > Number.EPSILON) {
        return scoreDiff;
    }

    return compareByFitnessThenCost(left, right);
};

const getDistinctSolutions = (
    pool: main.Individual[],
    limit: number,
    compare: (left: main.Individual, right: main.Individual) => number,
) => {
    const unique: main.Individual[] = [];
    const sorted = [...pool]
        .filter(individual => individual.fitness > 0)
        .sort(compare);

    for (const candidate of sorted) {
        if (unique.some(current => areSolutionsSimilar(current, candidate))) {
            continue;
        }

        unique.push(candidate);
        if (unique.length >= limit) {
            break;
        }
    }

    return unique;
};

function App() {
    const [population, setPopulation] = useState<main.Individual[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [catalog, setCatalog] = useState<main.Sensor[]>([]);
    const [selectedIndividual, setSelectedIndividual] = useState<main.Individual | null>(null);
    const [optimalSolutions, setOptimalSolutions] = useState<main.Individual[]>([]);
    const [allSolutions, setAllSolutions] = useState<main.Individual[]>([]);
    const [config, setConfig] = useState<main.Config>(DEFAULT_CONFIG);

    const [dynamicScale, setDynamicScale] = useState(10);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const syncPopulationSnapshot = async () => {
        const solutions = await GetAllSolutions();
        setPopulation(solutions);
        setAllSolutions(solutions);
    };

    useEffect(() => {
        let active = true;

        const bootstrap = async () => {
            const backendConfig = await GetConfig();
            if (!active) {
                return;
            }

            setConfig(backendConfig);
            await InitPopulation();
            if (!active) {
                return;
            }

            const [solutions, sensorCatalog] = await Promise.all([
                GetAllSolutions(),
                GetCatalog(),
            ]);

            if (!active) {
                return;
            }

            setPopulation(solutions);
            setAllSolutions(solutions);
            setCatalog(sensorCatalog);
        };

        bootstrap().catch(console.error);

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const updateScale = () => {
            if (!containerRef.current) return;
            const padding = 64;
            const availableWidth = containerRef.current.clientWidth - padding;
            const availableHeight = containerRef.current.clientHeight - padding;
            const scaleW = availableWidth / config.areaWidth;
            const scaleH = availableHeight / config.areaHeight;
            setDynamicScale(Math.min(scaleW, scaleH));
        };
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [config.areaWidth, config.areaHeight]);

    useEffect(() => {
        const loadOptimalSolutions = async () => {
            const solutions = await GetOptimalSolutions(10);
            setOptimalSolutions(getDistinctSolutions(solutions, 10, compareByScoreThenFitness));
        };

        if (population.length > 0) {
            loadOptimalSolutions().catch(console.error);
            return;
        }

        setOptimalSolutions([]);
    }, [population]);

    const handleConfigChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const nextConfig = { ...config, [name]: Number(value) };
        setConfig(nextConfig);
        setSelectedIndividual(null);

        try {
            await SetConstraints(nextConfig as main.Config);
            await syncPopulationSnapshot();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCatalogUpdate = async (index: number, field: 'range' | 'cost', value: number) => {
        const nextCatalog = catalog.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [field]: value } : item
        ));

        setCatalog(nextCatalog);
        setSelectedIndividual(null);

        try {
            await UpdateCatalog(nextCatalog);
            await syncPopulationSnapshot();
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        let active = true;

        async function loop() {
            if (!isRunning || !active) return;

            try {
                const nextGen = await Evolve();
                if (active && isRunning) {
                    setPopulation(nextGen);
                    setAllSolutions(nextGen);
                    setTimeout(loop, 10);
                }
            } catch (err) {
                console.error(err);
            }
        }

        if (isRunning) {
            loop();
        }

        return () => {
            active = false;
        };
    }, [isRunning]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || population.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, config.areaWidth * dynamicScale, config.areaHeight * dynamicScale);
        const displayTarget = selectedIndividual || population.find(point => point.isPareto) || population[0];

        displayTarget?.sensors?.forEach(sensor => {
            const colors = SENSOR_COLORS[sensor.type] || SENSOR_COLORS["Standard-B"];
            ctx.beginPath();
            ctx.arc(sensor.x * dynamicScale, sensor.y * dynamicScale, sensor.range * dynamicScale, 0, 2 * Math.PI);
            ctx.fillStyle = colors.bg;
            ctx.fill();
            ctx.strokeStyle = colors.stroke;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sensor.x * dynamicScale, sensor.y * dynamicScale, 3, 0, 2 * Math.PI);
            ctx.fillStyle = colors.dot;
            ctx.fill();
        });
    }, [population, config, dynamicScale, selectedIndividual]);

    const paretoSolutions = getDistinctSolutions(
        population.filter(individual => individual.isPareto),
        10,
        compareByFitnessThenCost,
    );

    const bestCompromises = getDistinctSolutions(
        population,
        10,
        compareByFitnessThenCost,
    );

    const globalRanking = getDistinctSolutions(
        allSolutions,
        20,
        compareByScoreThenFitness,
    );

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
            <aside className="bg-slate-900 w-max min-w-max border-r border-slate-800 p-5 flex flex-col gap-6 overflow-y-auto shadow-2xl z-10 custom-scrollbar">
                <h1 className="text-2xl font-black text-white tracking-tighter text-center italic">RCSF<span className="text-emerald-500">.mg</span></h1>

                <div className="flex gap-4">
                    <div className="w-72 flex-col space-y-5">
                        <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hauteur (m)</label>
                                    <input type="number" name="areaHeight" value={config.areaHeight} onChange={handleConfigChange} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono mt-1" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Largeur (m)</label>
                                    <input type="number" name="areaWidth" value={config.areaWidth} onChange={handleConfigChange} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono mt-1" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Population</label>
                                    <span className="text-[10px] font-mono text-emerald-500">{config.population} individus</span>
                                </div>
                                <input type="range" name="population" min="10" max="200" step="10" value={config.population} onChange={handleConfigChange} className="w-full mt-2 accent-emerald-500" />
                            </div>

                            <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Budget Max (Ar)</label>
                                <input type="number" name="maxBudget" value={config.maxBudget} onChange={handleConfigChange} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono mt-1 text-emerald-400 font-bold" />
                            </div>
                        </div>

                        <div className="space-y-3 bg-slate-800/20 p-4 rounded-xl border border-slate-800/50">
                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Édition du Catalogue</label>
                            <div className="space-y-2">
                                {catalog.map((item, idx) => (
                                    <div key={item.type} className="flex items-center gap-3 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENSOR_COLORS[item.type]?.dot }}></div>
                                        <div className="text-[10px] font-bold w-16 uppercase">{item.type.split('-')[0]}</div>
                                        <div className="flex gap-2 flex-1 items-center">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] text-slate-600 uppercase">Portée</span>
                                                <input type="number" value={item.range} onChange={(e) => handleCatalogUpdate(idx, 'range', Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-center" />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[8px] text-slate-600 uppercase text-right">Prix (Ar)</span>
                                                <input type="number" value={item.cost} onChange={(e) => handleCatalogUpdate(idx, 'cost', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-right text-emerald-500 font-mono" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => setIsRunning(!isRunning)} className={`w-full py-4 rounded-xl font-black tracking-widest transition-all active:scale-[0.98] shadow-lg ${isRunning ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/40'}`}>
                            {isRunning ? "ARRÊTER L'OPTIMISATION" : "LANCER L'OPTIMISATION"}
                        </button>

                        <div className="mt-auto">
                            <ParetoChart population={population} />
                        </div>
                    </div>

                    <div className="w-80 flex flex-col gap-6">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Top 10 Pareto Solutions</h3>
                                {selectedIndividual && (
                                    <button onClick={() => setSelectedIndividual(null)} className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all">AUTO</button>
                                )}
                            </div>
                            <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-800/50 text-[9px] text-slate-500 uppercase">
                                        <tr>
                                            <th className="p-3">Cover %</th>
                                            <th className="p-3 text-emerald-500">Coût (Ar)</th>
                                            <th className="p-3 text-right">Matériel</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/40 font-mono">
                                        {paretoSolutions.map((individual) => (
                                            <tr
                                                key={getSolutionKey(individual)}
                                                onClick={() => setSelectedIndividual(individual)}
                                                className={`cursor-pointer transition-colors text-[10px] hover:bg-slate-800 ${selectedIndividual === individual ? 'bg-emerald-500/10 text-emerald-400' : ''}`}
                                            >
                                                <td className="p-3 font-bold">{individual.fitness.toFixed(1)}%</td>
                                                <td className="p-3">{individual.totalCost.toLocaleString()}</td>
                                                <td className="p-3 text-right flex justify-end gap-1">
                                                    {Object.entries(formatMaterial(individual.sensors)).map(([type, count]) => (
                                                        <span
                                                            key={`${getSolutionKey(individual)}-${type}`}
                                                            className="ml-1 text-[8px] bg-slate-900 px-1 rounded"
                                                        >
                                                            {count}{type[0]}
                                                        </span>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h3 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">
                                Solutions Optimales Diversifiées
                            </h3>

                            <div className="bg-slate-950/50 border border-emerald-500/20 rounded-xl overflow-hidden">
                                <table className="w-full text-[10px] font-mono">
                                    <tbody>
                                        {optimalSolutions.map((individual) => {
                                            const isSelected = selectedIndividual === individual;

                                            return (
                                                <tr
                                                    key={getSolutionKey(individual)}
                                                    onClick={() => setSelectedIndividual(individual)}
                                                    className={`cursor-pointer transition-colors hover:bg-emerald-500/10 ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : ''}`}
                                                >
                                                    <td className="p-2 text-emerald-400 font-bold">
                                                        {individual.fitness.toFixed(1)}%
                                                    </td>

                                                    <td className="p-2">
                                                        {individual.totalCost.toLocaleString()} Ar
                                                    </td>

                                                    <td className="p-2 text-right">
                                                        {Object.entries(formatMaterial(individual.sensors)).map(([type, count]) => (
                                                            <span
                                                                key={`${getSolutionKey(individual)}-${type}`}
                                                                className="ml-1 text-[8px] bg-slate-900 px-1 rounded"
                                                            >
                                                                {count}{type[0]}
                                                            </span>
                                                        ))}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h3 className="text-[10px] font-bold text-yellow-400 uppercase mb-2">
                                Meilleurs Compromis
                            </h3>

                            <div className="bg-slate-950/50 border border-yellow-500/20 rounded-xl overflow-hidden">
                                <table className="w-full text-[10px] font-mono">
                                    <tbody>
                                        {bestCompromises.map((individual) => {
                                            const isSelected = selectedIndividual === individual;

                                            return (
                                                <tr
                                                    key={getSolutionKey(individual)}
                                                    onClick={() => setSelectedIndividual(individual)}
                                                    className={`cursor-pointer hover:bg-yellow-500/10 ${isSelected ? 'bg-yellow-500/10 text-yellow-300' : ''}`}
                                                >
                                                    <td className="p-2 text-yellow-400 font-bold">
                                                        {individual.fitness.toFixed(1)}%
                                                    </td>

                                                    <td className="p-2">
                                                        {individual.totalCost.toLocaleString()} Ar
                                                    </td>

                                                    <td className="p-2 text-right flex justify-end gap-1">
                                                        {Object.entries(formatMaterial(individual.sensors)).map(([type, count]) => (
                                                            <span key={`${getSolutionKey(individual)}-${type}`} className="ml-1 text-[8px] bg-slate-900 px-1 rounded">
                                                                {count}{type[0]}
                                                            </span>
                                                        ))}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h3 className="text-[10px] font-bold text-blue-400 uppercase mb-2">
                                Ranking Global (Score Multi-Objectif)
                            </h3>

                            <div className="bg-slate-950/50 border border-blue-500/20 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full text-[10px] font-mono">
                                    <tbody>
                                        {globalRanking.map((individual, index) => {
                                            const isSelected = selectedIndividual === individual;

                                            return (
                                                <tr
                                                    key={getSolutionKey(individual)}
                                                    onClick={() => setSelectedIndividual(individual)}
                                                    className={`cursor-pointer hover:bg-blue-500/10 ${isSelected ? 'bg-blue-500/10 text-blue-300' : ''}`}
                                                >
                                                    <td className="p-2 text-blue-400">#{index + 1}</td>
                                                    <td className="p-2">{individual.fitness.toFixed(1)}%</td>
                                                    <td className="p-2">{individual.totalCost.toLocaleString()} Ar</td>
                                                    <td className="p-2 text-right flex justify-end gap-1">
                                                        {Object.entries(formatMaterial(individual.sensors)).map(([type, count]) => (
                                                            <span key={`${getSolutionKey(individual)}-${type}`} className="ml-1 text-[8px] bg-slate-900 px-1 rounded">
                                                                {count}{type[0]}
                                                            </span>
                                                        ))}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <main ref={containerRef} className="flex-1 min-w-0 flex items-center justify-center p-8 bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-size-[20px_20px]">
                <div className="relative rounded-2xl border-4 border-slate-800 bg-slate-900 overflow-hidden shadow-[0_0_80px_-15px_rgba(0,0,0,0.6)]"
                    style={{ width: config.areaWidth * dynamicScale, height: config.areaHeight * dynamicScale }}>
                    <canvas ref={canvasRef} width={config.areaWidth * dynamicScale} height={config.areaHeight * dynamicScale} />
                    <div className="absolute top-4 left-4 flex flex-col gap-1">
                        <div className="px-3 py-1 bg-slate-950/90 backdrop-blur rounded-lg border border-white/10 shadow-xl">
                            <span className="text-[10px] font-mono text-slate-500">{config.areaWidth}m x {config.areaHeight}m</span>
                        </div>
                        <div className={`px-3 py-1 bg-slate-950/90 backdrop-blur rounded-lg border border-white/10 shadow-xl text-[10px] font-bold uppercase ${selectedIndividual ? 'text-blue-400' : 'text-emerald-500'}`}>
                            {selectedIndividual ? "Consultation Alternative" : "Simulation Active"}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
