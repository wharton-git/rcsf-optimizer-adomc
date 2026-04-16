package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

const (
	solutionCostTolerance    = 50000.0
	solutionFitnessTolerance = 0.2
)

func compareByFitnessDescCostAsc(left Individual, right Individual) bool {
	if math.Abs(left.Fitness-right.Fitness) > 1e-9 {
		return left.Fitness > right.Fitness
	}

	if math.Abs(left.TotalCost-right.TotalCost) > 1e-9 {
		return left.TotalCost < right.TotalCost
	}

	if len(left.Sensors) != len(right.Sensors) {
		return len(left.Sensors) < len(right.Sensors)
	}

	return solutionMaterialKey(left) < solutionMaterialKey(right)
}

func scoreOf(individual Individual) float64 {
	if individual.TotalCost <= 0 {
		return 0
	}

	return individual.Fitness / (individual.TotalCost + 1)
}

func compareByScoreDesc(left Individual, right Individual) bool {
	leftScore := scoreOf(left)
	rightScore := scoreOf(right)

	if math.Abs(leftScore-rightScore) > 1e-12 {
		return leftScore > rightScore
	}

	return compareByFitnessDescCostAsc(left, right)
}

func solutionMaterialKey(individual Individual) string {
	counts := map[string]int{}
	for _, sensor := range individual.Sensors {
		counts[sensor.Type]++
	}

	keys := make([]string, 0, len(counts))
	for key := range counts {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	builder := strings.Builder{}
	for _, key := range keys {
		builder.WriteString(fmt.Sprintf("%s:%d|", key, counts[key]))
	}

	return builder.String()
}

func buildSolutionID(individual Individual) string {
	replacer := strings.NewReplacer("|", "-", ":", "-", " ", "-", ".", "-")
	return fmt.Sprintf(
		"sol-%s-%.0f-%d",
		replacer.Replace(solutionMaterialKey(individual)),
		math.Round(individual.TotalCost),
		int(math.Round(individual.Fitness*10)),
	)
}

func areSimilarSolutions(left Individual, right Individual) bool {
	if len(left.Sensors) != len(right.Sensors) {
		return false
	}

	if solutionMaterialKey(left) != solutionMaterialKey(right) {
		return false
	}

	return math.Abs(left.TotalCost-right.TotalCost) <= solutionCostTolerance &&
		math.Abs(left.Fitness-right.Fitness) <= solutionFitnessTolerance
}

func containsSimilarSolution(selected []Individual, candidate Individual) bool {
	for _, current := range selected {
		if areSimilarSolutions(current, candidate) {
			return true
		}
	}

	return false
}

func filterDistinctSolutions(candidates []Individual, limit int) []Individual {
	selected := make([]Individual, 0, len(candidates))

	for _, candidate := range candidates {
		if containsSimilarSolution(selected, candidate) {
			continue
		}

		selected = append(selected, candidate)
		if limit > 0 && len(selected) >= limit {
			break
		}
	}

	return selected
}

func dominates(left Individual, right Individual) bool {
	return (left.Fitness >= right.Fitness && left.TotalCost <= right.TotalCost) &&
		(left.Fitness > right.Fitness || left.TotalCost < right.TotalCost)
}

func (a *App) UpdateParetoFront() {
	for index := range a.points {
		a.points[index].IsPareto = true
	}

	for i := range a.points {
		if a.points[i].Fitness == 0 {
			a.points[i].IsPareto = false
			continue
		}

		for j := range a.points {
			if i == j || a.points[j].Fitness == 0 {
				continue
			}

			if dominates(a.points[j], a.points[i]) {
				a.points[i].IsPareto = false
				break
			}
		}
	}

	paretoIndexes := make([]int, 0, len(a.points))
	for index := range a.points {
		if a.points[index].IsPareto {
			paretoIndexes = append(paretoIndexes, index)
		}
	}

	sort.SliceStable(paretoIndexes, func(i int, j int) bool {
		return compareByFitnessDescCostAsc(a.points[paretoIndexes[i]], a.points[paretoIndexes[j]])
	})

	selected := make([]Individual, 0, len(paretoIndexes))
	for _, index := range paretoIndexes {
		if containsSimilarSolution(selected, a.points[index]) {
			a.points[index].IsPareto = false
			continue
		}

		selected = append(selected, a.points[index])
	}
}
