import { main } from "../../wailsjs/go/models";
import { formatCost, formatPercent } from "../utils/solutions";

interface Props {
    analysis: main.DecisionAnalysis | null;
    recommendedSolution: main.RankedSolution | null;
    baselineRecommended: main.RankedSolution | null;
    onFocusRecommended: () => void;
    onExportCSV: () => void;
    onExportJSON: () => void;
}

export default function RecommendationPanel({
    analysis,
    recommendedSolution,
    baselineRecommended,
    onFocusRecommended,
    onExportCSV,
    onExportJSON,
}: Props) {
    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white">Solution recommandee</h2>
                    <p className="text-sm text-slate-400">
                        Resultat de la couche ADOMC appliquee au front de Pareto.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onExportCSV}
                        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
                    >
                        Export CSV
                    </button>
                    <button
                        onClick={onExportJSON}
                        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
                    >
                        Export JSON
                    </button>
                </div>
            </div>

            {!analysis || !recommendedSolution ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
                    L'analyse multicritere sera affichee ici des qu'une population valide sera disponible.
                </div>
            ) : (
                <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
                                    Scenario {analysis.scenario.name}
                                </div>
                                <div className="mt-1 text-2xl font-black text-white">{recommendedSolution.label}</div>
                            </div>

                            <button
                                onClick={onFocusRecommended}
                                className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950"
                            >
                                Afficher
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">TOPSIS</div>
                                <div className="mt-1 text-xl font-bold text-emerald-300">{recommendedSolution.topsisScore.toFixed(3)}</div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Couverture</div>
                                <div className="mt-1 text-xl font-bold text-slate-100">{formatPercent(recommendedSolution.metrics.coverage)}</div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Cout</div>
                                <div className="mt-1 text-lg font-bold text-slate-100">{formatCost(recommendedSolution.metrics.cost)}</div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Robustesse</div>
                                <div className="mt-1 text-lg font-bold text-slate-100">{formatPercent(recommendedSolution.metrics.robustness)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                        <div className="font-semibold text-white">Pourquoi cette solution ?</div>
                        <p className="mt-2 leading-6">{analysis.summary}</p>
                        <p className="mt-3 leading-6 text-slate-400">{recommendedSolution.explanation}</p>
                    </div>

                    {baselineRecommended && baselineRecommended.solutionID !== recommendedSolution.solutionID && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                            <div className="font-semibold">Comparaison methodologique</div>
                            <p className="mt-2">
                                La somme ponderee recommande {baselineRecommended.label}, alors que TOPSIS recommande {recommendedSolution.label}.
                                Cette divergence est utile a commenter pendant la soutenance.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
