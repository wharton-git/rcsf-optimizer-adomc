import { useDeferredValue, useEffect, useRef, useState } from 'react';
import {
    AnalyzeDecision,
    Evolve,
    ExportDecisionCSV,
    ExportDecisionJSON,
    GetAllSolutions,
    GetCatalog,
    GetConfig,
    GetDecisionCriteria,
    GetDecisionScenarios,
    GetOptimalSolutions,
    InitPopulation,
    SetConstraints,
    UpdateCatalog,
} from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import ComparisonPanel from './components/ComparisonPanel';
import DecisionControls from './components/DecisionControls';
import DecisionRankingTable, { type DecisionSortConfig, type DecisionSortKey } from './components/DecisionRankingTable';
import ParetoChart from './components/ParetoChart';
import PriorityZonesPanel from './components/PriorityZonesPanel';
import RecommendationPanel from './components/RecommendationPanel';
import SensitivityPanel from './components/SensitivityPanel';
import {
    SENSOR_COLORS,
    formatCost,
    formatMaterial,
    formatPercent,
    getIndividualKey,
    getRankedSolutionById,
} from './utils/solutions';

const DEFAULT_CONFIG = main.Config.createFrom({
    areaWidth: 80,
    areaHeight: 60,
    population: 50,
    maxBudget: 2000000,
    priorityZones: [],
    forbiddenZones: [],
    obstacleZones: [],
    mandatoryZones: [],
});

const DEFAULT_WEIGHTS: main.DecisionWeights = {
    coverage: 0.3,
    cost: 0.25,
    overlap: 0.15,
    sensorCount: 0.1,
    robustness: 0.2,
};

const DEFAULT_REQUEST = main.DecisionRequest.createFrom({
    scenarioID: "balanced",
    candidateSource: "pareto",
    primaryMethod: "topsis",
    weights: DEFAULT_WEIGHTS,
});

const DEFAULT_SORT: DecisionSortConfig = {
    key: 'rank',
    direction: 'asc',
};

const PARETO_SHORTLIST_LIMIT = 10;

const buildCatalogSummary = (sensors: main.Sensor[]) => sensors.map(sensor => ({
    id: sensor.id,
    type: sensor.type,
    range: sensor.range,
    cost: sensor.cost,
}));

const buildIndividualSummary = (individual: main.Individual | null | undefined) => {
    if (!individual) {
        return null;
    }

    return {
        key: getIndividualKey(individual),
        coverage: individual.fitness,
        cost: individual.totalCost,
        sensorCount: individual.sensors.length,
        paretoStatus: individual.isPareto,
        material: formatMaterial(individual.sensors),
    };
};

const buildPopulationSummary = (individuals: main.Individual[]) => {
    if (individuals.length === 0) {
        return {
            count: 0,
            paretoCount: 0,
            bestCoverage: null,
            lowestCost: null,
            sample: [],
        };
    }

    const bestCoverage = individuals.reduce((best, current) => (
        current.fitness > best.fitness ? current : best
    ), individuals[0]);

    const lowestCost = individuals.reduce((best, current) => (
        current.totalCost < best.totalCost ? current : best
    ), individuals[0]);

    return {
        count: individuals.length,
        paretoCount: individuals.filter(individual => individual.isPareto).length,
        bestCoverage: buildIndividualSummary(bestCoverage),
        lowestCost: buildIndividualSummary(lowestCost),
        sample: individuals.slice(0, 3).map(buildIndividualSummary),
    };
};

const buildRankedSolutionSummary = (solution: main.RankedSolution | null | undefined) => {
    if (!solution) {
        return null;
    }

    return {
        solutionID: solution.solutionID,
        label: solution.label,
        rank: solution.rank,
        topsisScore: solution.topsisScore,
        weightedSumScore: solution.weightedSumScore,
        paretoStatus: solution.paretoStatus,
        coverage: solution.metrics.coverage,
        cost: solution.metrics.cost,
        overlap: solution.metrics.overlap,
        sensorCount: solution.metrics.sensorCount,
        robustness: solution.metrics.robustness,
        key: getIndividualKey(solution.individual),
    };
};

const buildDecisionAnalysisSummary = (analysis: main.DecisionAnalysis | null) => {
    if (!analysis) {
        return null;
    }

    return {
        scenarioID: analysis.scenario?.id || null,
        scenarioName: analysis.scenario?.name || null,
        candidateSource: analysis.candidateSource,
        primaryMethod: analysis.primaryMethod,
        baselineMethod: analysis.baselineMethod,
        rankedCount: analysis.rankedSolutions.length,
        recommendedSolution: buildRankedSolutionSummary(
            getRankedSolutionById(analysis, analysis.recommendedSolutionID),
        ),
        weightedSumRecommendedSolution: buildRankedSolutionSummary(
            getRankedSolutionById(analysis, analysis.weightedSumRecommendedSolutionID),
        ),
        topSolutions: analysis.rankedSolutions.slice(0, 3).map(buildRankedSolutionSummary),
        summary: analysis.summary,
    };
};

const logAlgorithmPayload = (
    stage: 'input' | 'output',
    operation: string,
    payload: unknown,
    summary?: unknown,
) => {
    console.groupCollapsed(`[algorithm][${operation}][${stage}]`);
    if (summary !== undefined) {
        console.log("summary", summary);
    }
    console.log("payload", payload);
    console.groupEnd();
};

const buildSensitivitySummary = (
    previousAnalysis: main.DecisionAnalysis | null,
    nextAnalysis: main.DecisionAnalysis | null,
) => {
    if (!previousAnalysis || !nextAnalysis) {
        return "";
    }

    const previousTop = previousAnalysis.rankedSolutions[0];
    const nextTop = nextAnalysis.rankedSolutions[0];
    if (!previousTop || !nextTop) {
        return "";
    }

    const parts: string[] = [];

    if (previousTop.solutionID === nextTop.solutionID) {
        parts.push(`${nextTop.label} reste la solution recommandee.`);
    } else {
        parts.push(`La recommandation change de ${previousTop.label} vers ${nextTop.label} quand les poids evoluent.`);
    }

    const previousRanks = new Map(previousAnalysis.rankedSolutions.map(solution => [solution.solutionID, solution.rank]));
    const majorMoves = nextAnalysis.rankedSolutions
        .slice(0, 5)
        .filter(solution => {
            const previousRank = previousRanks.get(solution.solutionID);
            return previousRank && Math.abs(previousRank - solution.rank) >= 2;
        })
        .map(solution => `${solution.label} (${previousRanks.get(solution.solutionID)} -> ${solution.rank})`);

    if (majorMoves.length === 0) {
        parts.push("Le haut du classement reste globalement stable.");
    } else {
        parts.push(`Les principaux changements de rang sont: ${majorMoves.join(', ')}.`);
    }

    return parts.join(' ');
};

const sortRankedSolutions = (
    solutions: main.RankedSolution[],
    sortConfig: DecisionSortConfig,
) => {
    const sorted = [...solutions];
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    sorted.sort((left, right) => {
        const getValue = (solution: main.RankedSolution, key: DecisionSortKey) => {
            switch (key) {
                case 'label':
                    return solution.label;
                case 'coverage':
                    return solution.metrics.coverage;
                case 'cost':
                    return solution.metrics.cost;
                case 'overlap':
                    return solution.metrics.overlap;
                case 'sensorCount':
                    return solution.metrics.sensorCount;
                case 'robustness':
                    return solution.metrics.robustness;
                case 'topsis':
                    return solution.topsisScore;
                case 'rank':
                    return solution.rank;
                case 'paretoStatus':
                    return solution.paretoStatus ? 1 : 0;
                default:
                    return solution.rank;
            }
        };

        const leftValue = getValue(left, sortConfig.key);
        const rightValue = getValue(right, sortConfig.key);

        if (typeof leftValue === 'string' && typeof rightValue === 'string') {
            return leftValue.localeCompare(rightValue) * direction;
        }

        return ((leftValue as number) - (rightValue as number)) * direction;
    });

    return sorted;
};

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

function App() {
    const [population, setPopulation] = useState<main.Individual[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [catalog, setCatalog] = useState<main.Sensor[]>([]);
    const [config, setConfig] = useState<main.Config>(DEFAULT_CONFIG);
    const [paretoShortlist, setParetoShortlist] = useState<main.Individual[]>([]);

    const [decisionCriteria, setDecisionCriteria] = useState<main.DecisionCriterion[]>([]);
    const [decisionScenarios, setDecisionScenarios] = useState<main.DecisionScenario[]>([]);
    const [decisionRequest, setDecisionRequest] = useState<main.DecisionRequest>(DEFAULT_REQUEST);
    const [decisionAnalysis, setDecisionAnalysis] = useState<main.DecisionAnalysis | null>(null);
    const [previousDecisionAnalysis, setPreviousDecisionAnalysis] = useState<main.DecisionAnalysis | null>(null);
    const [sensitivitySummary, setSensitivitySummary] = useState("");

    const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(null);
    const [selectedSolutionKey, setSelectedSolutionKey] = useState<string | null>(null);
    const [comparisonIds, setComparisonIds] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<DecisionSortConfig>(DEFAULT_SORT);

    const [dynamicScale, setDynamicScale] = useState(10);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastAnalysisRef = useRef<main.DecisionAnalysis | null>(null);
    const decisionChangedByWeightsRef = useRef(false);
    const evolutionStepRef = useRef(0);
    const analysisRunRef = useRef(0);
    const populationRef = useRef<main.Individual[]>([]);
    const configRef = useRef<main.Config>(DEFAULT_CONFIG);
    const catalogRef = useRef<main.Sensor[]>([]);

    const deferredPopulation = useDeferredValue(population);

    populationRef.current = population;
    configRef.current = config;
    catalogRef.current = catalog;

    const refreshSolutionsFromBackend = async (source: string) => {
        logAlgorithmPayload("input", `${source}:RefreshSolutions`, {
            paretoShortlistLimit: PARETO_SHORTLIST_LIMIT,
        });

        const [solutions, shortlist] = await Promise.all([
            GetAllSolutions(),
            GetOptimalSolutions(PARETO_SHORTLIST_LIMIT),
        ]);

        logAlgorithmPayload("output", `${source}:RefreshSolutions`, {
            solutions,
            shortlist,
        }, {
            population: buildPopulationSummary(solutions),
            paretoShortlist: buildPopulationSummary(shortlist),
        });

        setPopulation(solutions);
        setParetoShortlist(shortlist);

        return { solutions, shortlist };
    };

    useEffect(() => {
        let active = true;

        const bootstrap = async () => {
            const [backendConfig, sensorCatalog, scenarios, criteria] = await Promise.all([
                GetConfig(),
                GetCatalog(),
                GetDecisionScenarios(),
                GetDecisionCriteria(),
            ]);

            if (!active) {
                return;
            }

            const balancedScenario = scenarios.find(scenario => scenario.id === "balanced") || scenarios[0];

            setConfig(main.Config.createFrom(backendConfig));
            setCatalog(sensorCatalog);
            setDecisionScenarios(scenarios);
            setDecisionCriteria(criteria);
            setDecisionRequest(main.DecisionRequest.createFrom({
                scenarioID: balancedScenario?.id || DEFAULT_REQUEST.scenarioID,
                candidateSource: DEFAULT_REQUEST.candidateSource,
                primaryMethod: DEFAULT_REQUEST.primaryMethod,
                weights: balancedScenario?.weights || DEFAULT_WEIGHTS,
            }));

            logAlgorithmPayload("input", "InitPopulation", {
                config: backendConfig,
                catalog: sensorCatalog,
            }, {
                config: backendConfig,
                catalog: buildCatalogSummary(sensorCatalog),
            });

            await InitPopulation();
            if (!active) {
                return;
            }

            evolutionStepRef.current = 0;
            await refreshSolutionsFromBackend("InitPopulation");
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
            const scaleW = availableWidth / Math.max(config.areaWidth, 1);
            const scaleH = availableHeight / Math.max(config.areaHeight, 1);
            setDynamicScale(Math.min(scaleW, scaleH));
        };

        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [config.areaWidth, config.areaHeight]);

    useEffect(() => {
        if (deferredPopulation.length === 0) {
            setDecisionAnalysis(null);
            setParetoShortlist([]);
            return;
        }

        let active = true;

        const loadDecisionData = async () => {
            const analysisRun = analysisRunRef.current + 1;
            analysisRunRef.current = analysisRun;

            logAlgorithmPayload("input", `AnalyzeDecision#${analysisRun}`, {
                request: decisionRequest,
                config,
                catalog,
                population: deferredPopulation,
            }, {
                request: decisionRequest,
                config,
                catalog: buildCatalogSummary(catalog),
                population: buildPopulationSummary(deferredPopulation),
            });

            const [analysis, shortlist] = await Promise.all([
                AnalyzeDecision(decisionRequest),
                GetOptimalSolutions(PARETO_SHORTLIST_LIMIT),
            ]);

            if (!active) {
                return;
            }

            logAlgorithmPayload("output", `AnalyzeDecision#${analysisRun}`, {
                analysis,
                shortlist,
            }, {
                analysis: buildDecisionAnalysisSummary(analysis),
                paretoShortlist: buildPopulationSummary(shortlist),
            });

            const previousAnalysis = decisionChangedByWeightsRef.current ? lastAnalysisRef.current : null;
            setPreviousDecisionAnalysis(previousAnalysis);
            setSensitivitySummary(buildSensitivitySummary(previousAnalysis, analysis));
            setDecisionAnalysis(analysis);
            setParetoShortlist(shortlist);
            lastAnalysisRef.current = analysis;
            decisionChangedByWeightsRef.current = false;

            if (!analysis.rankedSolutions.some(solution => solution.solutionID === selectedSolutionId)) {
                const recommended = analysis.rankedSolutions[0];
                setSelectedSolutionId(recommended?.solutionID || null);
                setSelectedSolutionKey(recommended ? getIndividualKey(recommended.individual) : null);
            }
        };

        loadDecisionData().catch(console.error);

        return () => {
            active = false;
        };
    }, [deferredPopulation, decisionRequest, selectedSolutionId]);

    useEffect(() => {
        let active = true;

        const loop = async () => {
            if (!isRunning || !active) {
                return;
            }

            try {
                const evolutionStep = evolutionStepRef.current + 1;
                evolutionStepRef.current = evolutionStep;

                logAlgorithmPayload("input", `Evolve#${evolutionStep}`, {
                    config: configRef.current,
                    catalog: catalogRef.current,
                    population: populationRef.current,
                }, {
                    config: configRef.current,
                    catalog: buildCatalogSummary(catalogRef.current),
                    population: buildPopulationSummary(populationRef.current),
                });

                const nextGeneration = await Evolve();
                logAlgorithmPayload("output", `Evolve#${evolutionStep}`, {
                    population: nextGeneration,
                }, {
                    population: buildPopulationSummary(nextGeneration),
                });

                if (active && isRunning) {
                    decisionChangedByWeightsRef.current = false;
                    setPopulation(nextGeneration);
                    setTimeout(loop, 25);
                }
            } catch (error) {
                console.error(error);
            }
        };

        if (isRunning) {
            loop();
        }

        return () => {
            active = false;
        };
    }, [isRunning]);

    const recommendedSolution = decisionAnalysis?.rankedSolutions[0] || null;
    const recommendedSolutionKey = recommendedSolution
        ? getIndividualKey(recommendedSolution.individual)
        : null;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || population.length === 0) {
            return;
        }

        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }

        context.clearRect(0, 0, config.areaWidth * dynamicScale, config.areaHeight * dynamicScale);

        config.priorityZones.forEach(zone => {
            context.fillStyle = 'rgba(251, 191, 36, 0.14)';
            context.strokeStyle = 'rgba(251, 191, 36, 0.55)';
            context.lineWidth = 1;
            context.fillRect(
                zone.x * dynamicScale,
                zone.y * dynamicScale,
                zone.width * dynamicScale,
                zone.height * dynamicScale,
            );
            context.strokeRect(
                zone.x * dynamicScale,
                zone.y * dynamicScale,
                zone.width * dynamicScale,
                zone.height * dynamicScale,
            );
        });

        const displayTarget = population.find(individual => getIndividualKey(individual) === selectedSolutionKey)
            || population.find(individual => getIndividualKey(individual) === recommendedSolutionKey)
            || population.find(individual => individual.isPareto)
            || population[0];
        displayTarget?.sensors?.forEach(sensor => {
            const colors = SENSOR_COLORS[sensor.type] || SENSOR_COLORS["Standard-B"];
            context.beginPath();
            context.arc(sensor.x * dynamicScale, sensor.y * dynamicScale, sensor.range * dynamicScale, 0, 2 * Math.PI);
            context.fillStyle = colors.bg;
            context.fill();
            context.strokeStyle = colors.stroke;
            context.stroke();
            context.beginPath();
            context.arc(sensor.x * dynamicScale, sensor.y * dynamicScale, 4, 0, 2 * Math.PI);
            context.fillStyle = colors.dot;
            context.fill();
        });
    }, [config, dynamicScale, population, recommendedSolutionKey, selectedSolutionKey]);

    const handleConfigChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        const nextConfig = main.Config.createFrom({
            ...config,
            [name]: Number(value),
        });

        setConfig(nextConfig);
        setSelectedSolutionId(null);
        setSelectedSolutionKey(null);
        decisionChangedByWeightsRef.current = false;

        try {
            logAlgorithmPayload("input", "SetConstraints", {
                previousConfig: config,
                nextConfig,
            }, {
                previousConfig: config,
                nextConfig,
            });

            await SetConstraints(nextConfig as main.Config);
            logAlgorithmPayload("output", "SetConstraints", {
                status: "ok",
                appliedConfig: nextConfig,
            });
            evolutionStepRef.current = 0;
            await refreshSolutionsFromBackend("SetConstraints");
        } catch (error) {
            console.error(error);
        }
    };

    const handleCatalogUpdate = async (index: number, field: 'range' | 'cost', value: number) => {
        const nextCatalog = catalog.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [field]: value } : item
        ));

        setCatalog(nextCatalog);
        setSelectedSolutionId(null);
        setSelectedSolutionKey(null);
        decisionChangedByWeightsRef.current = false;

        try {
            logAlgorithmPayload("input", "UpdateCatalog", {
                previousCatalog: catalog,
                nextCatalog,
            }, {
                previousCatalog: buildCatalogSummary(catalog),
                nextCatalog: buildCatalogSummary(nextCatalog),
            });

            await UpdateCatalog(nextCatalog);
            logAlgorithmPayload("output", "UpdateCatalog", {
                status: "ok",
                appliedCatalog: nextCatalog,
            }, {
                appliedCatalog: buildCatalogSummary(nextCatalog),
            });
            evolutionStepRef.current = 0;
            await refreshSolutionsFromBackend("UpdateCatalog");
        } catch (error) {
            console.error(error);
        }
    };

    const handlePriorityZonesChange = async (zones: main.PriorityZone[]) => {
        const nextConfig = main.Config.createFrom({
            ...config,
            priorityZones: zones,
        });

        setConfig(nextConfig);
        decisionChangedByWeightsRef.current = false;

        try {
            logAlgorithmPayload("input", "SetConstraints:PriorityZones", {
                previousConfig: config,
                nextConfig,
            }, {
                previousPriorityZones: config.priorityZones,
                nextPriorityZones: nextConfig.priorityZones,
            });

            await SetConstraints(nextConfig as main.Config);
            logAlgorithmPayload("output", "SetConstraints:PriorityZones", {
                status: "ok",
                appliedConfig: nextConfig,
            }, {
                appliedPriorityZones: nextConfig.priorityZones,
            });
            evolutionStepRef.current = 0;
            await refreshSolutionsFromBackend("SetConstraints:PriorityZones");
        } catch (error) {
            console.error(error);
        }
    };

    const handleScenarioSelect = (scenario: main.DecisionScenario) => {
        decisionChangedByWeightsRef.current = true;
        setDecisionRequest(main.DecisionRequest.createFrom({
            ...decisionRequest,
            scenarioID: scenario.id,
            weights: scenario.weights,
        }));
    };

    const handleWeightChange = (key: keyof main.DecisionWeights, value: number) => {
        decisionChangedByWeightsRef.current = true;
        setDecisionRequest(main.DecisionRequest.createFrom({
            ...decisionRequest,
            scenarioID: "manual",
            weights: {
                ...decisionRequest.weights,
                [key]: value,
            },
        }));
    };

    const handleCandidateSourceChange = (candidateSource: string) => {
        decisionChangedByWeightsRef.current = true;
        setDecisionRequest(main.DecisionRequest.createFrom({
            ...decisionRequest,
            candidateSource,
        }));
    };

    const handleSortChange = (key: DecisionSortKey) => {
        setSortConfig(current => (
            current.key === key
                ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: key === 'rank' ? 'asc' : 'desc' }
        ));
    };

    const logSelectedSolution = (
        source: string,
        individual: main.Individual,
        rankedSolution: main.RankedSolution | null = null,
    ) => {
        console.log("[selected-solution]", {
            source,
            solutionID: rankedSolution?.solutionID ?? null,
            label: rankedSolution?.label ?? null,
            key: getIndividualKey(individual),
            rank: rankedSolution?.rank ?? null,
            paretoStatus: rankedSolution?.paretoStatus ?? individual.isPareto,
            metrics: rankedSolution ? {
                coverage: rankedSolution.metrics.coverage,
                cost: rankedSolution.metrics.cost,
                overlap: rankedSolution.metrics.overlap,
                sensorCount: rankedSolution.metrics.sensorCount,
                robustness: rankedSolution.metrics.robustness,
                worstCaseCoverage: rankedSolution.metrics.worstCaseCoverage,
                averageFailureCoverage: rankedSolution.metrics.averageFailureCoverage,
            } : {
                coverage: individual.fitness,
                cost: individual.totalCost,
                overlap: null,
                sensorCount: individual.sensors.length,
                robustness: null,
                worstCaseCoverage: null,
                averageFailureCoverage: null,
            },
            topsisScore: rankedSolution?.topsisScore ?? null,
            weightedSumScore: rankedSolution?.weightedSumScore ?? null,
            material: formatMaterial(individual.sensors),
            sensors: individual.sensors,
            explanation: rankedSolution?.explanation ?? null,
        });
    };

    const handleSelectRankedSolution = (solutionID: string) => {
        const solution = getRankedSolutionById(decisionAnalysis, solutionID);

        setSelectedSolutionId(solutionID);
        setSelectedSolutionKey(solution ? getIndividualKey(solution.individual) : null);

        if (solution) {
            logSelectedSolution("decision-ranking-table", solution.individual, solution);
        }
    };

    const toggleComparison = (solutionID: string) => {
        setComparisonIds(current => {
            if (current.includes(solutionID)) {
                return current.filter(id => id !== solutionID);
            }
            if (current.length >= 3) {
                return [...current.slice(1), solutionID];
            }
            return [...current, solutionID];
        });
    };

    const handleExportCSV = async () => {
        try {
            const content = await ExportDecisionCSV(decisionRequest);
            downloadTextFile("decision-analysis.csv", content, "text/csv;charset=utf-8");
        } catch (error) {
            console.error(error);
        }
    };

    const handleExportJSON = async () => {
        try {
            const content = await ExportDecisionJSON(decisionRequest);
            downloadTextFile("decision-analysis.json", content, "application/json;charset=utf-8");
        } catch (error) {
            console.error(error);
        }
    };

    const sortedRankedSolutions = sortRankedSolutions(
        decisionAnalysis?.rankedSolutions || [],
        sortConfig,
    );

    const comparisonSolutions = comparisonIds
        .map(solutionID => getRankedSolutionById(decisionAnalysis, solutionID))
        .filter((solution): solution is main.RankedSolution => Boolean(solution));

    const baselineRecommended = getRankedSolutionById(
        decisionAnalysis,
        decisionAnalysis?.weightedSumRecommendedSolutionID || "",
    );

    const displayTarget = population.find(individual => getIndividualKey(individual) === selectedSolutionKey)
        || population.find(individual => getIndividualKey(individual) === recommendedSolutionKey)
        || population.find(individual => individual.isPareto)
        || population[0];

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
            <aside className="w-105 shrink-0 border-r border-slate-800 bg-slate-900/95 p-5 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white italic">
                            RCSF<span className="text-emerald-400">.mg</span>
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Optimisation hybride GA + PSO, enrichie par une couche ADOMC explicite.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Largeur (m)</label>
                                <input
                                    type="number"
                                    name="areaWidth"
                                    value={config.areaWidth}
                                    onChange={handleConfigChange}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Hauteur (m)</label>
                                <input
                                    type="number"
                                    name="areaHeight"
                                    value={config.areaHeight}
                                    onChange={handleConfigChange}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Population</label>
                                <span className="text-xs font-mono text-emerald-400">{config.population}</span>
                            </div>
                            <input
                                type="range"
                                name="population"
                                min="10"
                                max="200"
                                step="10"
                                value={config.population}
                                onChange={handleConfigChange}
                                className="mt-2 w-full accent-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Budget max (Ar)</label>
                            <input
                                type="number"
                                name="maxBudget"
                                value={config.maxBudget}
                                onChange={handleConfigChange}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-emerald-300"
                            />
                        </div>
                    </div>

                    <DecisionControls
                        criteria={decisionCriteria}
                        scenarios={decisionScenarios}
                        request={decisionRequest}
                        onScenarioSelect={handleScenarioSelect}
                        onWeightChange={handleWeightChange}
                        onCandidateSourceChange={handleCandidateSourceChange}
                    />

                    <PriorityZonesPanel
                        zones={config.priorityZones}
                        areaWidth={config.areaWidth}
                        areaHeight={config.areaHeight}
                        onChange={handlePriorityZonesChange}
                    />

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Catalogue</h2>
                            <span className="text-[11px] text-slate-500">Capteurs editables</span>
                        </div>

                        <div className="mt-3 space-y-3">
                            {catalog.map((item, index) => (
                                <div key={item.type} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: SENSOR_COLORS[item.type]?.dot || '#94a3b8' }}
                                        />
                                        <span className="text-sm font-semibold">{item.type}</span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Portee</label>
                                            <input
                                                type="number"
                                                value={item.range}
                                                onChange={(event) => handleCatalogUpdate(index, 'range', Number(event.target.value))}
                                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Cout (Ar)</label>
                                            <input
                                                type="number"
                                                value={item.cost}
                                                onChange={(event) => handleCatalogUpdate(index, 'cost', Number(event.target.value))}
                                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setIsRunning(!isRunning)}
                        className={`w-full rounded-2xl px-4 py-4 text-sm font-black tracking-[0.22em] transition-colors ${isRunning
                            ? 'border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            }`}
                    >
                        {isRunning ? "ARRETER L'OPTIMISATION" : "LANCER L'OPTIMISATION"}
                    </button>
                </div>
            </aside>

            <main className="flex-1 min-w-0 overflow-y-auto p-6 custom-scrollbar">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                    <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Carte de deploiement</h2>
                                <p className="text-sm text-slate-400">
                                    {displayTarget ? `Affichage de ${formatCost(displayTarget.totalCost)} pour ${displayTarget.sensors.length} capteur(s).` : "Aucune solution affichee."}
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 text-right">
                                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Zone</div>
                                <div className="text-sm font-mono text-slate-200">
                                    {config.areaWidth}m x {config.areaHeight}m
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-3xl border border-slate-800 bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-size-[20px_20px] p-4">
                            <div
                                ref={containerRef}
                                className="flex min-h-105 items-center justify-center overflow-hidden rounded-[20px] border border-slate-800 bg-slate-950"
                            >
                                <div
                                    className="relative overflow-hidden rounded-[20px] border-4 border-slate-800 bg-slate-900"
                                    style={{
                                        width: config.areaWidth * dynamicScale,
                                        height: config.areaHeight * dynamicScale,
                                    }}
                                >
                                    <canvas
                                        ref={canvasRef}
                                        width={config.areaWidth * dynamicScale}
                                        height={config.areaHeight * dynamicScale}
                                    />

                                    <div className="absolute left-4 top-4 space-y-2">
                                        <div className="rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300">
                                            {recommendedSolution
                                                ? `Solution recommandee: ${recommendedSolution.label}`
                                                : "Simulation active"}
                                        </div>
                                        {displayTarget && (
                                            <div className="rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-400">
                                                Couverture: {formatPercent(displayTarget.fitness)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="space-y-6">
                        <RecommendationPanel
                            analysis={decisionAnalysis}
                            recommendedSolution={recommendedSolution}
                            baselineRecommended={baselineRecommended}
                            onFocusRecommended={() => {
                                if (recommendedSolution) {
                                    setSelectedSolutionId(recommendedSolution.solutionID);
                                    setSelectedSolutionKey(getIndividualKey(recommendedSolution.individual));
                                    logSelectedSolution("recommendation-panel", recommendedSolution.individual, recommendedSolution);
                                }
                            }}
                            onExportCSV={handleExportCSV}
                            onExportJSON={handleExportJSON}
                        />

                        <SensitivityPanel summary={sensitivitySummary} />

                        <ComparisonPanel
                            solutions={comparisonSolutions}
                            onFocusSolution={(solution) => {
                                setSelectedSolutionId(solution.solutionID);
                                setSelectedSolutionKey(getIndividualKey(solution.individual));
                                logSelectedSolution("comparison-panel", solution.individual, solution);
                            }}
                            onRemoveSolution={(solutionID) => {
                                setComparisonIds(current => current.filter(id => id !== solutionID));
                            }}
                        />
                    </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.55fr)]">
                    <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Front de Pareto</h2>
                                <p className="text-sm text-slate-400">
                                    La recommandation ADOMC reste superposee au front existant.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <ParetoChart
                                population={population}
                                selectedSolutionKey={selectedSolutionKey}
                                recommendedSolutionKey={recommendedSolutionKey}
                            />
                        </div>
                    </section>

                    <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Pareto shortlist</h2>
                                <p className="text-sm text-slate-400">
                                    Solutions non dominees pour continuer a justifier la decision.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 max-h-90 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-slate-900/95 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">Couverture</th>
                                        <th className="px-3 py-2">Cout</th>
                                        <th className="px-3 py-2 text-right">Materiel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {paretoShortlist.map(individual => {
                                        const solutionKey = getIndividualKey(individual);
                                        const isSelected = selectedSolutionKey === solutionKey;
                                        const rankedSolution = decisionAnalysis?.rankedSolutions.find(
                                            solution => getIndividualKey(solution.individual) === solutionKey,
                                        ) || null;

                                        return (
                                            <tr
                                                key={solutionKey}
                                                onClick={() => {
                                                    setSelectedSolutionKey(solutionKey);
                                                    logSelectedSolution("pareto-shortlist", individual, rankedSolution);
                                                }}
                                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500/10 text-emerald-200' : 'hover:bg-slate-800/60'}`}
                                            >
                                                <td className="px-3 py-3 font-semibold">{formatPercent(individual.fitness)}</td>
                                                <td className="px-3 py-3">{formatCost(individual.totalCost)}</td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {Object.entries(formatMaterial(individual.sensors)).map(([type, count]) => (
                                                            <span key={`${solutionKey}-${type}`} className="rounded bg-slate-950 px-2 py-1 text-[10px] text-slate-300">
                                                                {count}{type[0]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <section className="mt-6 rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white">Classement multicritere</h2>
                            <p className="text-sm text-slate-400">
                                Classement TOPSIS avec baseline somme ponderee, triable et selectionnable.
                            </p>
                        </div>

                        {decisionAnalysis && (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-right">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Candidats</div>
                                <div className="text-sm font-semibold text-slate-200">{decisionAnalysis.rankedSolutions.length}</div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <DecisionRankingTable
                            solutions={sortedRankedSolutions}
                            selectedSolutionId={selectedSolutionId}
                            comparisonIds={comparisonIds}
                            sortConfig={sortConfig}
                            onSortChange={handleSortChange}
                            onSelectSolution={handleSelectRankedSolution}
                            onToggleComparison={toggleComparison}
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}

export default App;
