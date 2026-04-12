import { useState, useEffect, useRef } from 'react';
import { Evolve, InitPopulation, SetConstraints, GetCatalog, UpdateCatalog, GetOptimalSolutions } from "../wailsjs/go/main/App";
import ParetoChart from './components/ParetoChart';
import { main } from "../wailsjs/go/models";

const SENSOR_COLORS: Record<string, { bg: string, stroke: string, dot: string }> = {
    "Eco-A": { bg: 'rgba(34, 197, 94, 0.15)', stroke: 'rgba(34, 197, 94, 0.4)', dot: '#22c55e' },
    "Standard-B": { bg: 'rgba(59, 130, 246, 0.15)', stroke: 'rgba(59, 130, 246, 0.4)', dot: '#3b82f6' },
    "Premium-C": { bg: 'rgba(168, 85, 247, 0.15)', stroke: 'rgba(168, 85, 247, 0.4)', dot: '#a855f7' },
};

function App() {
    const [population, setPopulation] = useState<main.Individual[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [catalog, setCatalog] = useState<main.Sensor[]>([]);
    const [selectedIndividual, setSelectedIndividual] = useState<main.Individual | null>(null);
    const [optimalSolutions, setOptimalSolutions] = useState<main.Individual[]>([]);
    const [config, setConfig] = useState({
        areaWidth: 80,
        areaHeight: 60,
        population: 50,
        maxBudget: 1000000,
    });

    const [dynamicScale, setDynamicScale] = useState(10);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        InitPopulation();
        GetCatalog().then(setCatalog);
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
        const load = async () => {
            const res = await GetOptimalSolutions(10);
            setOptimalSolutions(res);
        };

        if (population.length > 0) {
            load();
        }
    }, [population]);

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newConfig = { ...config, [name]: Number(value) };
        setConfig(newConfig);

        console.log("Envoi au Backend :", {
            areaWidth: Number(newConfig.areaWidth),
            areaHeight: Number(newConfig.areaHeight),
            population: Number(newConfig.population),
            maxBudget: Number(newConfig.maxBudget)
        });

        SetConstraints({
            areaWidth: Number(newConfig.areaWidth),
            areaHeight: Number(newConfig.areaHeight),
            population: Number(newConfig.population),
            maxBudget: Number(newConfig.maxBudget)
        } as main.Config);
    };

    const handleCatalogUpdate = (index: number, field: string, value: number) => {
        const newCatalog = [...catalog];
        // @ts-ignore
        newCatalog[index][field] = value;
        setCatalog(newCatalog);
        UpdateCatalog(newCatalog);
    };

    useEffect(() => {
        let active = true;
        async function loop() {
            if (!isRunning || !active) return;
            try {
                const nextGen = await Evolve();
                if (active && isRunning) {
                    setPopulation(nextGen);
                    setTimeout(loop, 10);
                }
            } catch (err) { console.error(err); }
        }
        if (isRunning) loop();
        return () => { active = false; };
    }, [isRunning]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || population.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, config.areaWidth * dynamicScale, config.areaHeight * dynamicScale);
        const displayTarget = selectedIndividual || population.find(p => p.isPareto) || population[0];

        displayTarget?.sensors?.forEach(s => {
            const colors = SENSOR_COLORS[s.type] || SENSOR_COLORS["Standard-B"];
            ctx.beginPath();
            ctx.arc(s.x * dynamicScale, s.y * dynamicScale, s.range * dynamicScale, 0, 2 * Math.PI);
            ctx.fillStyle = colors.bg;
            ctx.fill();
            ctx.strokeStyle = colors.stroke;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(s.x * dynamicScale, s.y * dynamicScale, 3, 0, 2 * Math.PI);
            ctx.fillStyle = colors.dot;
            ctx.fill();
        });
    }, [population, config, dynamicScale, selectedIndividual]);

    const getSensorDetails = (sensors: main.Sensor[]) => {
        const counts: Record<string, number> = {};
        sensors.forEach(s => counts[s.type] = (counts[s.type] || 0) + 1);
        return counts;
    };

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

                        {/* Catalogue */}
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

                        {/* Pareto */}
                        <div className="mt-auto">
                            <ParetoChart population={population} />
                        </div>

                    </div>

                    <div className="w-80 flex flex-col gap-6">

                        {/* Tableau */}
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
                                        {population
                                            .filter(p => p.isPareto && p.fitness > 0)
                                            .sort((a, b) => b.fitness - a.fitness)
                                            .slice(0, 10)
                                            .map((ind, idx) => {
                                                const counts = getSensorDetails(ind.sensors);
                                                return (
                                                    <tr key={idx} onClick={() => setSelectedIndividual(ind)}
                                                        className={`cursor-pointer transition-colors text-[10px] hover:bg-slate-800 ${selectedIndividual === ind ? 'bg-emerald-500/10 text-emerald-400' : ''}`}>
                                                        <td className="p-3 font-bold">{ind.fitness.toFixed(1)}%</td>
                                                        <td className="p-3">{ind.totalCost.toLocaleString()}</td>
                                                        <td className="p-3 flex justify-end gap-1">
                                                            {Object.entries(counts).map(([type, count]) => (
                                                                <span key={type} className="bg-slate-900 px-1 rounded text-[8px] border border-slate-800" title={type}>
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
                            <h3 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">
                                Solutions Optimales Diversifiées
                            </h3>

                            <div className="bg-slate-950/50 border border-emerald-500/20 rounded-xl overflow-hidden">
                                <table className="w-full text-[10px] font-mono">
                                    <tbody>
                                        {optimalSolutions.map((ind, i) => {
                                            const counts = getSensorDetails(ind.sensors);

                                            const isSelected = selectedIndividual === ind;

                                            return (
                                                <tr
                                                    key={i}
                                                    onClick={() => setSelectedIndividual(ind)}
                                                    className={`
                                                                    cursor-pointer transition-colors
                                                                    hover:bg-emerald-500/10
                                                                    ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : ''}
                                                                `}
                                                >
                                                    <td className="p-2 text-emerald-400 font-bold">
                                                        {ind.fitness.toFixed(1)}%
                                                    </td>

                                                    <td className="p-2">
                                                        {ind.totalCost.toLocaleString()} Ar
                                                    </td>

                                                    <td className="p-2 text-right">
                                                        {Object.entries(counts).map(([t, c]) => (
                                                            <span
                                                                key={t}
                                                                className="ml-1 text-[8px] bg-slate-900 px-1 rounded"
                                                            >
                                                                {c}{t[0]}
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