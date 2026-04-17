package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

func structuralFamilyKey(individual Individual) string {
	return fmt.Sprintf("%d|%s", len(individual.Sensors), solutionMaterialKey(individual))
}

func formatSensorCountDistribution(distribution map[int]int) string {
	if len(distribution) == 0 {
		return "{}"
	}

	counts := make([]int, 0, len(distribution))
	for sensorCount := range distribution {
		counts = append(counts, sensorCount)
	}
	sort.Ints(counts)

	parts := make([]string, 0, len(counts))
	for _, sensorCount := range counts {
		parts = append(parts, fmt.Sprintf("%d:%d", sensorCount, distribution[sensorCount]))
	}

	return "{" + strings.Join(parts, ", ") + "}"
}

func averageSensorCountGap(population []Individual) float64 {
	if len(population) < 2 {
		return 0
	}

	totalGap := 0.0
	pairCount := 0

	for leftIndex := 0; leftIndex < len(population); leftIndex++ {
		for rightIndex := leftIndex + 1; rightIndex < len(population); rightIndex++ {
			totalGap += math.Abs(float64(len(population[leftIndex].Sensors) - len(population[rightIndex].Sensors)))
			pairCount++
		}
	}

	if pairCount == 0 {
		return 0
	}

	return totalGap / float64(pairCount)
}

func buildDiversityMetrics(
	generation int,
	population []Individual,
	paretoBeforeDedup int,
	paretoAfterDedup int,
) DiversityMetrics {
	metrics := DiversityMetrics{
		Generation:              generation,
		PopulationSize:          len(population),
		SensorCountDistribution: map[int]int{},
		ParetoBeforeDedup:       paretoBeforeDedup,
		ParetoAfterDedup:        paretoAfterDedup,
	}

	if len(population) == 0 {
		metrics.Summary = fmt.Sprintf(
			"generation=%d pop=0 pareto=%d/%d",
			generation,
			paretoAfterDedup,
			paretoBeforeDedup,
		)
		return metrics
	}

	materialSignatures := map[string]struct{}{}
	structuralFamilies := map[string]struct{}{}
	totalSensorCount := 0.0

	for _, individual := range population {
		sensorCount := len(individual.Sensors)
		metrics.SensorCountDistribution[sensorCount]++
		totalSensorCount += float64(sensorCount)

		materialSignatures[solutionMaterialKey(individual)] = struct{}{}
		structuralFamilies[structuralFamilyKey(individual)] = struct{}{}
	}

	metrics.DistinctSensorCounts = len(metrics.SensorCountDistribution)
	metrics.DistinctMaterialSignatures = len(materialSignatures)
	metrics.DistinctStructuralFamilies = len(structuralFamilies)
	metrics.AverageSensorCount = totalSensorCount / float64(len(population))
	metrics.AverageSensorCountGap = averageSensorCountGap(population)
	metrics.Summary = fmt.Sprintf(
		"generation=%d pop=%d sensor-counts=%s materials=%d families=%d pareto=%d/%d avg-sensors=%.2f avg-gap=%.2f",
		generation,
		len(population),
		formatSensorCountDistribution(metrics.SensorCountDistribution),
		metrics.DistinctMaterialSignatures,
		metrics.DistinctStructuralFamilies,
		paretoAfterDedup,
		paretoBeforeDedup,
		metrics.AverageSensorCount,
		metrics.AverageSensorCountGap,
	)

	return metrics
}
