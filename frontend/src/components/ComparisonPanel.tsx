import { main } from "../../wailsjs/go/models";
import { formatCost, formatPercent } from "../utils/solutions";

interface Props {
    solutions: main.RankedSolution[];
    onFocusSolution: (solution: main.RankedSolution) => void;
    onRemoveSolution: (solutionID: string) => void;
}

export default function ComparisonPanel({
    solutions,
    onFocusSolution,
    onRemoveSolution,
}: Props) {
    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
            <div>
                <h2 className="text-lg font-bold text-white">Comparaison</h2>
                <p className="text-sm text-slate-400">
                    Compare 2 a 3 solutions cote a cote.
                </p>
            </div>

            {solutions.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
                    Utilise le bouton "Ajouter" du tableau multicritere pour comparer plusieurs solutions.
                </div>
            ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {solutions.map(solution => (
                        <article key={solution.solutionID} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{solution.label}</div>
                                    <div className="mt-1 text-lg font-bold text-white">{formatPercent(solution.metrics.coverage)}</div>
                                </div>
                                <button
                                    onClick={() => onRemoveSolution(solution.solutionID)}
                                    className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300"
                                >
                                    Retirer
                                </button>
                            </div>

                            <div className="mt-4 space-y-2 text-sm text-slate-300">
                                <div className="flex justify-between"><span>Cout</span><span>{formatCost(solution.metrics.cost)}</span></div>
                                <div className="flex justify-between"><span>Chevauchement</span><span>{solution.metrics.overlap.toFixed(3)}</span></div>
                                <div className="flex justify-between"><span>Capteurs</span><span>{solution.metrics.sensorCount}</span></div>
                                <div className="flex justify-between"><span>Robustesse</span><span>{formatPercent(solution.metrics.robustness)}</span></div>
                                <div className="flex justify-between"><span>TOPSIS</span><span className="font-semibold text-emerald-300">{solution.topsisScore.toFixed(3)}</span></div>
                                <div className="flex justify-between"><span>Somme ponderee</span><span>{solution.weightedSumScore.toFixed(3)}</span></div>
                            </div>

                            <p className="mt-4 text-sm leading-6 text-slate-400">{solution.explanation}</p>

                            <button
                                onClick={() => onFocusSolution(solution)}
                                className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                            >
                                Afficher sur la carte
                            </button>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
