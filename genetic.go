package main

import (
	"math/rand"
	"sort"
)

const (
	geneticEliteRatio          = 0.2
	geneticDiversityEliteLimit = 4
	tournamentRounds           = 3
	positionMutationChance     = 0.2
	typeMutationChance         = 0.1
	positionMutationAmplitude  = 10.0
	structuralAddMutationRate  = 0.08
	structuralDropMutationRate = 0.08
	crossoverGeneReuseRate     = 0.75
	crossoverJitterAmplitude   = 6.0
	diversityShockRounds       = 2
)

func appendDistinctElite(target []Individual, candidate Individual) []Individual {
	if containsStrictDuplicateSolution(target, candidate) {
		return target
	}

	return append(target, cloneIndividual(candidate))
}

func selectStructuralElites(population []Individual, limit int) []Individual {
	if limit <= 0 {
		return nil
	}

	selected := make([]Individual, 0, limit)
	seenSensorCounts := map[int]struct{}{}
	seenFamilies := map[string]struct{}{}

	for _, candidate := range population {
		sensorCount := len(candidate.Sensors)
		family := structuralFamilyKey(candidate)

		if _, exists := seenSensorCounts[sensorCount]; exists {
			continue
		}
		if _, exists := seenFamilies[family]; exists {
			continue
		}

		selected = append(selected, cloneIndividual(candidate))
		seenSensorCounts[sensorCount] = struct{}{}
		seenFamilies[family] = struct{}{}

		if len(selected) >= limit {
			break
		}
	}

	if len(selected) >= limit {
		return selected
	}

	for _, candidate := range population {
		family := structuralFamilyKey(candidate)
		if _, exists := seenFamilies[family]; exists {
			continue
		}

		selected = append(selected, cloneIndividual(candidate))
		seenFamilies[family] = struct{}{}
		if len(selected) >= limit {
			break
		}
	}

	return selected
}

func (a *App) applyGeneticOperators() {
	sort.Slice(a.points, func(i int, j int) bool {
		return a.points[i].Fitness > a.points[j].Fitness
	})

	eliteSize := int(geneticEliteRatio * float64(len(a.points)))
	if eliteSize < 1 {
		eliteSize = 1
	}

	newPopulation := make([]Individual, 0, len(a.points))
	for _, elite := range a.points[:eliteSize] {
		newPopulation = appendDistinctElite(newPopulation, elite)
	}
	for _, elite := range selectStructuralElites(a.points[eliteSize:], geneticDiversityEliteLimit) {
		newPopulation = appendDistinctElite(newPopulation, elite)
	}

	for len(newPopulation) < len(a.points) {
		parentOne := a.tournamentSelect()
		parentTwo := a.tournamentSelect()

		child := a.crossover(parentOne, parentTwo)
		a.mutate(&child)
		a.reinitializeParticleState(&child)

		newPopulation = append(newPopulation, child)
	}

	a.points = newPopulation
}

func (a *App) tournamentSelect() Individual {
	best := a.points[rand.Intn(len(a.points))]

	for round := 0; round < tournamentRounds; round++ {
		candidate := a.points[rand.Intn(len(a.points))]
		if candidate.Fitness > best.Fitness {
			best = candidate
		}
	}

	return best
}

func removeVelocityAtIndex(velocities []Velocity, index int) []Velocity {
	if index < 0 || index >= len(velocities) {
		return append([]Velocity{}, velocities...)
	}

	remaining := make([]Velocity, 0, len(velocities)-1)
	remaining = append(remaining, velocities[:index]...)
	remaining = append(remaining, velocities[index+1:]...)

	return remaining
}

func chooseChildSensorCount(parentOne Individual, parentTwo Individual) int {
	minSensors := min(len(parentOne.Sensors), len(parentTwo.Sensors))
	maxSensors := max(len(parentOne.Sensors), len(parentTwo.Sensors))

	lowerBound := max(1, minSensors-1)
	upperBound := min(maxSensorsPerIndividual, maxSensors+1)
	if upperBound < lowerBound {
		upperBound = lowerBound
	}

	return lowerBound + rand.Intn(upperBound-lowerBound+1)
}

func shuffleSensors(sensors []Sensor) []Sensor {
	shuffled := cloneSensors(sensors)
	rand.Shuffle(len(shuffled), func(i int, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	return shuffled
}

func (a *App) inheritSensor(existing []Sensor, source Sensor) Sensor {
	inherited := source
	inherited.ID = len(existing)

	nextX := inherited.X + rand.Float64()*2*crossoverJitterAmplitude - crossoverJitterAmplitude
	nextY := inherited.Y + rand.Float64()*2*crossoverJitterAmplitude - crossoverJitterAmplitude
	nextX = max(0, min(a.config.AreaWidth, nextX))
	nextY = max(0, min(a.config.AreaHeight, nextY))

	if a.isSensorPositionAllowed(nextX, nextY) && !a.hasLocalSpacingConflict(existing, nextX, nextY, inherited.Range) {
		inherited.X = nextX
		inherited.Y = nextY
		return inherited
	}

	inherited.X, inherited.Y = a.randomSensorPosition(existing, inherited.Range)
	return inherited
}

func (a *App) crossover(parentOne Individual, parentTwo Individual) Individual {
	targetSensorCount := chooseChildSensorCount(parentOne, parentTwo)
	child := Individual{
		Sensors: make([]Sensor, 0, targetSensorCount),
	}

	candidates := append(
		shuffleSensors(parentOne.Sensors),
		shuffleSensors(parentTwo.Sensors)...,
	)
	candidates = shuffleSensors(candidates)

	for _, candidate := range candidates {
		if len(child.Sensors) >= targetSensorCount {
			break
		}
		if rand.Float64() > crossoverGeneReuseRate {
			continue
		}

		child.Sensors = append(child.Sensors, a.inheritSensor(child.Sensors, candidate))
	}

	for len(child.Sensors) < targetSensorCount {
		if rand.Float64() < 0.7 && (len(parentOne.Sensors) > 0 || len(parentTwo.Sensors) > 0) {
			var sourceParent []Sensor
			if len(parentOne.Sensors) == 0 {
				sourceParent = parentTwo.Sensors
			} else if len(parentTwo.Sensors) == 0 {
				sourceParent = parentOne.Sensors
			} else if rand.Float64() < 0.5 {
				sourceParent = parentOne.Sensors
			} else {
				sourceParent = parentTwo.Sensors
			}

			candidate := sourceParent[rand.Intn(len(sourceParent))]
			child.Sensors = append(child.Sensors, a.inheritSensor(child.Sensors, candidate))
			continue
		}

		if !a.addRandomSensor(&child) {
			break
		}
	}

	if len(child.Sensors) == 0 {
		a.addRandomSensor(&child)
	}

	reindexSensors(child.Sensors)
	return child
}

func (a *App) addRandomSensor(individual *Individual) bool {
	if len(individual.Sensors) >= maxSensorsPerIndividual {
		return false
	}

	template := SensorCatalog[rand.Intn(len(SensorCatalog))]
	nextSensor := a.buildSensorFromTemplate(individual.Sensors, template)
	nextSensor.ID = len(individual.Sensors)

	individual.Sensors = append(individual.Sensors, nextSensor)
	individual.Velocity = append(individual.Velocity, randomVelocity())
	return true
}

func (a *App) removeRandomSensor(individual *Individual) bool {
	if len(individual.Sensors) <= 1 {
		return false
	}

	index := rand.Intn(len(individual.Sensors))
	individual.Sensors = removeSensorAtIndex(individual.Sensors, index)
	individual.Velocity = removeVelocityAtIndex(individual.Velocity, index)
	reindexSensors(individual.Sensors)
	return true
}

func (a *App) applyStructuralMutation(individual *Individual) {
	if rand.Float64() < structuralAddMutationRate {
		a.addRandomSensor(individual)
	}

	if rand.Float64() < structuralDropMutationRate {
		a.removeRandomSensor(individual)
	}

	if len(individual.Sensors) == 0 {
		a.addRandomSensor(individual)
	}
}

func (a *App) mutate(individual *Individual) {
	for index := range individual.Sensors {
		if rand.Float64() < positionMutationChance {
			nextX := individual.Sensors[index].X + rand.Float64()*2*positionMutationAmplitude - positionMutationAmplitude
			nextY := individual.Sensors[index].Y + rand.Float64()*2*positionMutationAmplitude - positionMutationAmplitude

			nextX = max(0, min(a.config.AreaWidth, nextX))
			nextY = max(0, min(a.config.AreaHeight, nextY))

			if a.isSensorPositionAllowed(nextX, nextY) {
				individual.Sensors[index].X = nextX
				individual.Sensors[index].Y = nextY
			} else {
				individual.Sensors[index].X, individual.Sensors[index].Y = a.randomAllowedPosition()
			}
		}

		if rand.Float64() < typeMutationChance {
			template := SensorCatalog[rand.Intn(len(SensorCatalog))]
			individual.Sensors[index].Type = template.Type
			individual.Sensors[index].Range = template.Range
			individual.Sensors[index].Cost = template.Cost
		}
	}

	a.applyStructuralMutation(individual)
	reindexSensors(individual.Sensors)
}

func (a *App) rebalanceSensorCount(individual *Individual, targetCount int) {
	normalizedTarget := max(1, min(maxSensorsPerIndividual, targetCount))

	for len(individual.Sensors) < normalizedTarget {
		if !a.addRandomSensor(individual) {
			break
		}
	}

	for len(individual.Sensors) > normalizedTarget {
		if !a.removeRandomSensor(individual) {
			break
		}
	}
}

func (a *App) applyDiversityShock(individual *Individual) {
	for round := 0; round < diversityShockRounds; round++ {
		if len(individual.Sensors) <= 1 || (len(individual.Sensors) < maxSensorsPerIndividual && rand.Float64() < 0.6) {
			a.addRandomSensor(individual)
		} else {
			a.removeRandomSensor(individual)
		}

		a.mutate(individual)
	}

	a.reinitializeParticleState(individual)
}
