interface Props {
    summary: string;
}

export default function SensitivityPanel({ summary }: Props) {
    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
            <div>
                <h2 className="text-lg font-bold text-white">Analyse de sensibilite</h2>
                <p className="text-sm text-slate-400">
                    Le classement se recalcule immediatement quand les poids changent.
                </p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                {summary || "Modifie les ponderations ou change de scenario pour observer la stabilite de la recommandation."}
            </div>
        </section>
    );
}
