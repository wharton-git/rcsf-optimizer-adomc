import { main } from "../../wailsjs/go/models";

interface Props {
    zones: main.PriorityZone[];
    areaWidth: number;
    areaHeight: number;
    onChange: (zones: main.PriorityZone[]) => void;
}

export default function PriorityZonesPanel({
    zones,
    areaWidth,
    areaHeight,
    onChange,
}: Props) {
    const updateZone = (index: number, field: keyof main.PriorityZone, value: string | number) => {
        const nextZones = zones.map((zone, zoneIndex) => (
            zoneIndex === index ? { ...zone, [field]: value } : zone
        ));

        onChange(nextZones);
    };

    const addZone = () => {
        const nextIndex = zones.length + 1;
        onChange([
            ...zones,
            {
                id: `priority-${nextIndex}`,
                label: `Zone ${nextIndex}`,
                x: 0,
                y: 0,
                width: Math.min(areaWidth * 0.25, 20),
                height: Math.min(areaHeight * 0.25, 20),
                weight: 2,
            },
        ]);
    };

    const removeZone = (index: number) => {
        onChange(zones.filter((_, zoneIndex) => zoneIndex !== index));
    };

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Zones prioritaires</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Couverture spatialement ponderee. Les zones interdites et obstacles sont prevus dans la structure backend.
                    </p>
                </div>

                <button
                    onClick={addZone}
                    className="rounded-full bg-amber-400 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-950"
                >
                    Ajouter
                </button>
            </div>

            <div className="mt-4 space-y-3">
                {zones.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-500">
                        Aucune zone prioritaire pour le moment.
                    </div>
                )}

                {zones.map((zone, index) => (
                    <div key={zone.id || `zone-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="flex items-center justify-between">
                            <input
                                type="text"
                                value={zone.label}
                                onChange={(event) => updateZone(index, 'label', event.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold"
                            />
                            <button
                                onClick={() => removeZone(index)}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300"
                            >
                                Supprimer
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500">X</label>
                                <input
                                    type="number"
                                    value={zone.x}
                                    onChange={(event) => updateZone(index, 'x', Number(event.target.value))}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Y</label>
                                <input
                                    type="number"
                                    value={zone.y}
                                    onChange={(event) => updateZone(index, 'y', Number(event.target.value))}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Poids</label>
                                <input
                                    type="number"
                                    value={zone.weight}
                                    min="0.5"
                                    step="0.5"
                                    onChange={(event) => updateZone(index, 'weight', Number(event.target.value))}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                                />
                            </div>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Largeur</label>
                                <input
                                    type="number"
                                    value={zone.width}
                                    onChange={(event) => updateZone(index, 'width', Number(event.target.value))}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Hauteur</label>
                                <input
                                    type="number"
                                    value={zone.height}
                                    onChange={(event) => updateZone(index, 'height', Number(event.target.value))}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
