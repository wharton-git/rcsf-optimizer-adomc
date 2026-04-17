import { main } from "../../wailsjs/go/models";

export const SENSOR_COLORS: Record<string, { bg: string; stroke: string; dot: string }> = {
    "Eco-A": { bg: 'rgba(34, 197, 94, 0.15)', stroke: 'rgba(34, 197, 94, 0.4)', dot: '#22c55e' },
    "Standard-B": { bg: 'rgba(59, 130, 246, 0.15)', stroke: 'rgba(59, 130, 246, 0.4)', dot: '#3b82f6' },
    "Premium-C": { bg: 'rgba(168, 85, 247, 0.15)', stroke: 'rgba(168, 85, 247, 0.4)', dot: '#a855f7' },
};

export const formatMaterial = (sensors: main.Sensor[]) => {
    const counts: Record<string, number> = {};
    sensors.forEach(sensor => {
        counts[sensor.type] = (counts[sensor.type] || 0) + 1;
    });
    return counts;
};

export const getMaterialSignature = (sensors: main.Sensor[]) => Object.entries(formatMaterial(sensors))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `${type}:${count}`)
    .join('|');

const getSensorSignature = (sensor: main.Sensor) => (
    `${sensor.type}:${sensor.x.toFixed(3)}:${sensor.y.toFixed(3)}:${sensor.range.toFixed(3)}:${Math.round(sensor.cost)}`
);

export const getSensorLayoutSignature = (sensors: main.Sensor[]) => [...sensors]
    .map(getSensorSignature)
    .sort((left, right) => left.localeCompare(right))
    .join('|');

export const getIndividualKey = (individual: main.Individual) =>
    `${Math.round(individual.totalCost)}-${individual.fitness.toFixed(3)}-${getMaterialSignature(individual.sensors)}-${getSensorLayoutSignature(individual.sensors)}`;

export const formatCost = (value: number) => `${Math.round(value).toLocaleString()} Ar`;
export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export const getRankedSolutionById = (
    analysis: main.DecisionAnalysis | null,
    solutionID: string,
) => analysis?.rankedSolutions.find(solution => solution.solutionID === solutionID) || null;
