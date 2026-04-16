package main

import "math"

const (
	coverageSampleStep        = 2.0
	overlapThresholdFactor    = 0.5
	overlapPenaltyScale       = 0.3
	mandatoryZoneWeightFactor = 3.0
)

func calculateTotalCost(sensors []Sensor) float64 {
	totalCost := 0.0
	for _, sensor := range sensors {
		totalCost += sensor.Cost
	}

	return totalCost
}

func computeOverlapPenalty(sensors []Sensor) float64 {
	overlapPenalty := 0.0

	for i := 0; i < len(sensors); i++ {
		for j := i + 1; j < len(sensors); j++ {
			left := sensors[i]
			right := sensors[j]

			dx := left.X - right.X
			dy := left.Y - right.Y
			distance := math.Sqrt(dx*dx + dy*dy)
			minDistance := (left.Range + right.Range) * overlapThresholdFactor

			if distance < minDistance {
				overlapPenalty += (minDistance - distance) / minDistance
			}
		}
	}

	return overlapPenalty
}

func (a *App) CalculateFitness(individual *Individual) {
	individual.TotalCost = calculateTotalCost(individual.Sensors)
	if individual.TotalCost > a.config.MaxBudget {
		individual.Fitness = 0
		return
	}

	coverage := a.computeCoverage(individual.Sensors)
	overlapPenalty := computeOverlapPenalty(individual.Sensors)
	penaltyFactor := 1.0 / (1.0 + overlapPenalty*overlapPenaltyScale)

	individual.Fitness = coverage * penaltyFactor
}

func (a *App) computeCoverage(sensors []Sensor) float64 {
	coveredWeight, totalWeight := a.computeWeightedCoverageTotals(sensors)
	if totalWeight == 0 {
		return 0
	}

	return coveredWeight / totalWeight * 100
}

func (a *App) computeWeightedCoverageTotals(sensors []Sensor) (float64, float64) {
	coveredWeight := 0.0
	totalWeight := 0.0

	for x := 0.0; x < a.config.AreaWidth; x += coverageSampleStep {
		for y := 0.0; y < a.config.AreaHeight; y += coverageSampleStep {
			pointWeight := a.samplePointWeight(x, y)
			if pointWeight <= 0 {
				continue
			}

			totalWeight += pointWeight
			if isPointCovered(sensors, x, y) {
				coveredWeight += pointWeight
			}
		}
	}

	return coveredWeight, totalWeight
}

func isPointCovered(sensors []Sensor, x float64, y float64) bool {
	for _, sensor := range sensors {
		dx := x - sensor.X
		dy := y - sensor.Y
		if dx*dx+dy*dy <= sensor.Range*sensor.Range {
			return true
		}
	}

	return false
}

func pointInRectZone(x float64, y float64, zone RectZone) bool {
	return x >= zone.X &&
		x <= zone.X+zone.Width &&
		y >= zone.Y &&
		y <= zone.Y+zone.Height
}

func (a *App) isPointBlocked(x float64, y float64) bool {
	for _, zone := range a.config.ForbiddenZones {
		if pointInRectZone(x, y, zone) {
			return true
		}
	}

	for _, zone := range a.config.ObstacleZones {
		if pointInRectZone(x, y, zone) {
			return true
		}
	}

	return false
}

func (a *App) samplePointWeight(x float64, y float64) float64 {
	if a.isPointBlocked(x, y) {
		return 0
	}

	weight := 1.0

	for _, zone := range a.config.PriorityZones {
		if pointInRectZone(x, y, RectZone{
			X: zone.X, Y: zone.Y, Width: zone.Width, Height: zone.Height,
		}) {
			weight = math.Max(weight, zone.Weight)
		}
	}

	for _, zone := range a.config.MandatoryZones {
		if pointInRectZone(x, y, zone) {
			weight = math.Max(weight, mandatoryZoneWeightFactor)
		}
	}

	return weight
}

func removeSensorAtIndex(sensors []Sensor, index int) []Sensor {
	if index < 0 || index >= len(sensors) {
		return append([]Sensor{}, sensors...)
	}

	remaining := make([]Sensor, 0, len(sensors)-1)
	remaining = append(remaining, sensors[:index]...)
	remaining = append(remaining, sensors[index+1:]...)

	return remaining
}

func (a *App) computeRobustnessScore(sensors []Sensor) (float64, float64, float64) {
	baseCoverage := a.computeCoverage(sensors)
	if len(sensors) == 0 || baseCoverage <= 0 {
		return 0, 0, 0
	}

	worstCoverage := baseCoverage
	totalRemainingCoverage := 0.0

	for index := range sensors {
		remainingCoverage := a.computeCoverage(removeSensorAtIndex(sensors, index))
		totalRemainingCoverage += remainingCoverage
		worstCoverage = math.Min(worstCoverage, remainingCoverage)
	}

	averageCoverage := totalRemainingCoverage / float64(len(sensors))
	retentionScore := (worstCoverage / baseCoverage) * 100

	return retentionScore, worstCoverage, averageCoverage
}

func (a *App) buildSolutionMetrics(individual Individual) SolutionMetrics {
	cost := individual.TotalCost
	if cost <= 0 {
		cost = calculateTotalCost(individual.Sensors)
	}

	robustness, worstCaseCoverage, averageFailureCoverage := a.computeRobustnessScore(individual.Sensors)

	return SolutionMetrics{
		Coverage:               a.computeCoverage(individual.Sensors),
		Cost:                   cost,
		Overlap:                computeOverlapPenalty(individual.Sensors),
		SensorCount:            len(individual.Sensors),
		Robustness:             robustness,
		WorstCaseCoverage:      worstCaseCoverage,
		AverageFailureCoverage: averageFailureCoverage,
	}
}
