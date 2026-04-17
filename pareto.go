package main

import (
	"fmt"
	"hash/fnv"
	"math"
	"sort"
	"strings"
)

const (
	strictSolutionCostTolerance      = 1.0
	strictSolutionFitnessTolerance   = 0.02
	readableSolutionCostTolerance    = 15000.0
	readableSolutionFitnessTolerance = 0.1
	similarLayoutPositionTolerance   = 3.0
	strictLayoutPositionTolerance    = 0.25
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

func sortedSensorsForComparison(sensors []Sensor) []Sensor {
	sortedSensors := cloneSensors(sensors)
	sort.SliceStable(sortedSensors, func(i int, j int) bool {
		if sortedSensors[i].Type != sortedSensors[j].Type {
			return sortedSensors[i].Type < sortedSensors[j].Type
		}
		if math.Abs(sortedSensors[i].Range-sortedSensors[j].Range) > 1e-9 {
			return sortedSensors[i].Range < sortedSensors[j].Range
		}
		if math.Abs(sortedSensors[i].Cost-sortedSensors[j].Cost) > 1e-9 {
			return sortedSensors[i].Cost < sortedSensors[j].Cost
		}
		if math.Abs(sortedSensors[i].X-sortedSensors[j].X) > 1e-9 {
			return sortedSensors[i].X < sortedSensors[j].X
		}
		return sortedSensors[i].Y < sortedSensors[j].Y
	})

	return sortedSensors
}

func sensorsHaveSimilarLayout(left []Sensor, right []Sensor, positionTolerance float64) bool {
	if len(left) != len(right) {
		return false
	}

	sortedLeft := sortedSensorsForComparison(left)
	sortedRight := sortedSensorsForComparison(right)

	for index := range sortedLeft {
		if sortedLeft[index].Type != sortedRight[index].Type {
			return false
		}
		if math.Abs(sortedLeft[index].Range-sortedRight[index].Range) > 1e-9 {
			return false
		}
		if math.Abs(sortedLeft[index].Cost-sortedRight[index].Cost) > 1e-9 {
			return false
		}
		if math.Abs(sortedLeft[index].X-sortedRight[index].X) > positionTolerance {
			return false
		}
		if math.Abs(sortedLeft[index].Y-sortedRight[index].Y) > positionTolerance {
			return false
		}
	}

	return true
}

func solutionLayoutKey(individual Individual) string {
	sortedSensors := sortedSensorsForComparison(individual.Sensors)
	builder := strings.Builder{}

	for _, sensor := range sortedSensors {
		builder.WriteString(
			fmt.Sprintf(
				"%s@%.3f,%.3f,%.3f,%.0f|",
				sensor.Type,
				sensor.X,
				sensor.Y,
				sensor.Range,
				sensor.Cost,
			),
		)
	}

	return builder.String()
}

func buildSolutionID(individual Individual) string {
	replacer := strings.NewReplacer("|", "-", ":", "-", " ", "-", ".", "-")
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(solutionLayoutKey(individual)))
	return fmt.Sprintf(
		"sol-%s-%.0f-%d-%08x",
		replacer.Replace(solutionMaterialKey(individual)),
		math.Round(individual.TotalCost),
		int(math.Round(individual.Fitness*10)),
		hasher.Sum32(),
	)
}

func areStrictDuplicateSolutions(left Individual, right Individual) bool {
	if len(left.Sensors) != len(right.Sensors) {
		return false
	}

	if solutionMaterialKey(left) != solutionMaterialKey(right) {
		return false
	}

	return math.Abs(left.TotalCost-right.TotalCost) <= strictSolutionCostTolerance &&
		math.Abs(left.Fitness-right.Fitness) <= strictSolutionFitnessTolerance &&
		sensorsHaveSimilarLayout(left.Sensors, right.Sensors, strictLayoutPositionTolerance)
}

func areSimilarSolutions(left Individual, right Individual) bool {
	if len(left.Sensors) != len(right.Sensors) {
		return false
	}

	if solutionMaterialKey(left) != solutionMaterialKey(right) {
		return false
	}

	return math.Abs(left.TotalCost-right.TotalCost) <= readableSolutionCostTolerance &&
		math.Abs(left.Fitness-right.Fitness) <= readableSolutionFitnessTolerance &&
		sensorsHaveSimilarLayout(left.Sensors, right.Sensors, similarLayoutPositionTolerance)
}

func containsStrictDuplicateSolution(selected []Individual, candidate Individual) bool {
	for _, current := range selected {
		if areStrictDuplicateSolutions(current, candidate) {
			return true
		}
	}

	return false
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
	paretoBeforeDedup := len(paretoIndexes)

	sort.SliceStable(paretoIndexes, func(i int, j int) bool {
		return compareByFitnessDescCostAsc(a.points[paretoIndexes[i]], a.points[paretoIndexes[j]])
	})

	selected := make([]Individual, 0, len(paretoIndexes))
	for _, index := range paretoIndexes {
		if containsStrictDuplicateSolution(selected, a.points[index]) {
			a.points[index].IsPareto = false
			continue
		}

		selected = append(selected, a.points[index])
	}

	a.lastDiversityMetrics = buildDiversityMetrics(
		a.generation,
		a.points,
		paretoBeforeDedup,
		len(selected),
	)
}
