import { main } from "../../wailsjs/go/models";
import { formatCost, formatPercent } from "../utils/solutions";

export type DecisionSortKey =
    | 'label'
    | 'rank'
    | 'coverage'
    | 'cost'
    | 'overlap'
    | 'sensorCount'
    | 'robustness'
    | 'topsis'
    | 'paretoStatus';

export interface DecisionSortConfig {
    key: DecisionSortKey;
    direction: 'asc' | 'desc';
}

interface Props {
    solutions: main.RankedSolution[];
    selectedSolutionId: string | null;
    comparisonIds: string[];
    sortConfig: DecisionSortConfig;
    onSortChange: (key: DecisionSortKey) => void;
    onSelectSolution: (solutionID: string) => void;
    onToggleComparison: (solutionID: string) => void;
}

const headers: Array<{ key: DecisionSortKey; label: string }> = [
    { key: 'label', label: 'ID solution' },
    { key: 'rank', label: 'Rang' },
    { key: 'coverage', label: 'Couverture' },
    { key: 'cost', label: 'Cout' },
    { key: 'overlap', label: 'Chevauchement' },
    { key: 'sensorCount', label: 'Nb capteurs' },
    { key: 'robustness', label: 'Robustesse' },
    { key: 'topsis', label: 'TOPSIS' },
    { key: 'paretoStatus', label: 'Pareto' },
];

export default function DecisionRankingTable({
    solutions,
    selectedSolutionId,
    comparisonIds,
    sortConfig,
    onSortChange,
    onSelectSolution,
    onToggleComparison,
}: Props) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-245 text-left text-sm">
                <thead className="bg-slate-900/90 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                        {headers.map(header => (
                            <th key={header.key} className="px-3 py-3">
                                <button
                                    onClick={() => onSortChange(header.key)}
                                    className="inline-flex items-center gap-2 font-semibold hover:text-slate-200"
                                >
                                    <span>{header.label}</span>
                                    {sortConfig.key === header.key && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </button>
                            </th>
                        ))}
                        <th className="px-3 py-3 text-right">Comparer</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                    {solutions.map(solution => {
                        const isSelected = selectedSolutionId === solution.solutionID;
                        const isCompared = comparisonIds.includes(solution.solutionID);

                        return (
                            <tr
                                key={solution.solutionID}
                                onClick={() => onSelectSolution(solution.solutionID)}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-sky-500/10 text-sky-100' : 'hover:bg-slate-800/70'}`}
                            >
                                <td className="px-3 py-3 font-semibold">{solution.label}</td>
                                <td className="px-3 py-3">{solution.rank}</td>
                                <td className="px-3 py-3">{formatPercent(solution.metrics.coverage)}</td>
                                <td className="px-3 py-3">{formatCost(solution.metrics.cost)}</td>
                                <td className="px-3 py-3">{solution.metrics.overlap.toFixed(3)}</td>
                                <td className="px-3 py-3">{solution.metrics.sensorCount}</td>
                                <td className="px-3 py-3">{formatPercent(solution.metrics.robustness)}</td>
                                <td className="px-3 py-3 font-semibold text-emerald-300">{solution.topsisScore.toFixed(3)}</td>
                                <td className="px-3 py-3">
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${solution.paretoStatus
                                        ? 'bg-emerald-500/15 text-emerald-300'
                                        : 'bg-slate-700 text-slate-300'
                                        }`}
                                    >
                                        {solution.paretoStatus ? 'Oui' : 'Non'}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-right">
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onToggleComparison(solution.solutionID);
                                        }}
                                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${isCompared
                                            ? 'bg-amber-400 text-slate-950'
                                            : 'border border-slate-700 bg-slate-900 text-slate-300'
                                            }`}
                                    >
                                        {isCompared ? 'Retirer' : 'Ajouter'}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
