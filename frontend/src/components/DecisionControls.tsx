import { main } from "../../wailsjs/go/models";

type WeightKey = keyof main.DecisionWeights;
const manualScenarioID = "manual";

interface Props {
    criteria: main.DecisionCriterion[];
    scenarios: main.DecisionScenario[];
    request: main.DecisionRequest;
    onScenarioSelect: (scenario: main.DecisionScenario) => void;
    onWeightChange: (key: WeightKey, value: number) => void;
    onCandidateSourceChange: (candidateSource: string) => void;
}

const criterionToWeightKey: Record<string, WeightKey> = {
    coverage: 'coverage',
    cost: 'cost',
    overlap: 'overlap',
    sensor_count: 'sensorCount',
    robustness: 'robustness',
};

const clampWeight = (value: number) => Math.min(1, Math.max(0, value));

export default function DecisionControls({
    criteria,
    scenarios,
    request,
    onScenarioSelect,
    onWeightChange,
    onCandidateSourceChange,
}: Props) {
    const isManualMode = request.scenarioID === manualScenarioID;
    const manualScenario = main.DecisionScenario.createFrom({
        id: manualScenarioID,
        name: "Manuel",
        description: "Ponderation ajustable via les sliders.",
        weights: request.weights,
    });

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Criteres et ponderations</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        TOPSIS utilise ces poids apres le filtrage Pareto.
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {[...scenarios, manualScenario].map(scenario => {
                    const isActive = request.scenarioID === scenario.id;
                    return (
                        <button
                            key={scenario.id}
                            onClick={() => onScenarioSelect(scenario)}
                            className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${isActive
                                ? 'bg-emerald-500 text-slate-950'
                                : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/40 hover:text-white'
                                }`}
                        >
                            {scenario.name}
                        </button>
                    );
                })}
            </div>

            {!isManualMode && (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                    Les poids des scenarios predefinis sont verrouilles. Passez en mode manuel pour les modifier.
                </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                    onClick={() => onCandidateSourceChange('pareto')}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${request.candidateSource === 'pareto'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'border border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                >
                    Pareto
                </button>
                <button
                    onClick={() => onCandidateSourceChange('valid')}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${request.candidateSource === 'valid'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'border border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                >
                    Solutions valides
                </button>
            </div>

            <div className="mt-4 space-y-4">
                {criteria.map(criterion => {
                    const weightKey = criterionToWeightKey[criterion.id];
                    const weightValue = clampWeight(request.weights[weightKey]);

                    return (
                        <div key={criterion.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white">{criterion.label}</div>
                                    <div className="text-xs text-slate-500">{criterion.description}</div>
                                </div>

                                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${criterion.goal === 'maximize'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-amber-500/15 text-amber-300'
                                    }`}
                                >
                                    {criterion.goal === 'maximize' ? 'Max' : 'Min'}
                                </span>
                            </div>

                            <div className="mt-3 flex items-center gap-3 overflow-hidden">
                                <div className="min-w-0 flex-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={weightValue}
                                        disabled={!isManualMode}
                                        onChange={(event) => onWeightChange(weightKey, clampWeight(Number(event.target.value)))}
                                        className="block w-full min-w-0 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                                    />
                                </div>

                                <div className={`w-16 shrink-0 rounded-lg border px-2 py-1.5 text-center text-sm font-semibold ${isManualMode
                                    ? 'border-slate-700 bg-slate-950 text-slate-100'
                                    : 'border-slate-800 bg-slate-950/80 text-slate-400'
                                    }`}
                                >
                                    {weightValue.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
