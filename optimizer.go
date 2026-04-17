package main

import (
	"math"
	"math/rand"
	"sort"
	"time"
)

const (
	maxSensorsPerIndividual       = 10
	maxPlacementAttempts          = 10
	maxAllowedPositionSearchTries = 50
	initialVelocityAmplitude      = 1.0
	initialSpacingFactor          = 0.5
	diversityInjectionInterval    = 5
	diversityInjectionRatio       = 0.12
	diversityElitePoolRatio       = 0.3
)

func (a *App) InitPopulation() {
	rand.Seed(time.Now().UnixNano())
	a.generation = 0
	a.points = make([]Individual, a.config.Population)

	for index := 0; index < a.config.Population; index++ {
		a.points[index] = a.createRandomIndividual(a.sampleSensorCount())
	}

	a.UpdateParetoFront()
}

func randomVelocity() Velocity {
	return Velocity{
		VX: rand.Float64()*2*initialVelocityAmplitude - initialVelocityAmplitude,
		VY: rand.Float64()*2*initialVelocityAmplitude - initialVelocityAmplitude,
	}
}

func cloneSensors(sensors []Sensor) []Sensor {
	cloned := make([]Sensor, len(sensors))
	copy(cloned, sensors)
	return cloned
}

func cloneVelocities(velocities []Velocity) []Velocity {
	cloned := make([]Velocity, len(velocities))
	copy(cloned, velocities)
	return cloned
}

func cloneIndividual(individual Individual) Individual {
	return Individual{
		Sensors:   cloneSensors(individual.Sensors),
		Velocity:  cloneVelocities(individual.Velocity),
		PBest:     cloneSensors(individual.PBest),
		BestFit:   individual.BestFit,
		Fitness:   individual.Fitness,
		TotalCost: individual.TotalCost,
		IsPareto:  individual.IsPareto,
	}
}

func reindexSensors(sensors []Sensor) {
	for index := range sensors {
		sensors[index].ID = index
	}
}

func (a *App) sampleSensorCount() int {
	if maxSensorsPerIndividual <= 3 {
		return rand.Intn(maxSensorsPerIndividual) + 1
	}

	roll := rand.Float64()
	switch {
	case roll < 0.25:
		return rand.Intn(3) + 1
	case roll < 0.50:
		return maxSensorsPerIndividual - 2 + rand.Intn(3)
	default:
		return rand.Intn(maxSensorsPerIndividual) + 1
	}
}

func (a *App) buildSensorFromTemplate(existing []Sensor, template Sensor) Sensor {
	x, y := a.randomSensorPosition(existing, template.Range)
	return Sensor{
		X:     x,
		Y:     y,
		Range: template.Range,
		Cost:  template.Cost,
		Type:  template.Type,
	}
}

func (a *App) reinitializeParticleState(individual *Individual) {
	reindexSensors(individual.Sensors)
	individual.Velocity = make([]Velocity, len(individual.Sensors))
	for index := range individual.Velocity {
		individual.Velocity[index] = randomVelocity()
	}

	individual.PBest = cloneSensors(individual.Sensors)
	a.CalculateFitness(individual)
	individual.BestFit = individual.Fitness
}

func (a *App) createRandomIndividual(sensorCount int) Individual {
	normalizedCount := max(1, min(maxSensorsPerIndividual, sensorCount))
	sensors := make([]Sensor, 0, normalizedCount)

	for len(sensors) < normalizedCount {
		template := SensorCatalog[rand.Intn(len(SensorCatalog))]
		sensors = append(sensors, a.buildSensorFromTemplate(sensors, template))
	}

	individual := Individual{Sensors: sensors}
	a.reinitializeParticleState(&individual)
	return individual
}

func (a *App) leastRepresentedSensorCount() int {
	distribution := map[int]int{}
	for _, individual := range a.points {
		distribution[len(individual.Sensors)]++
	}

	minCount := math.MaxInt
	candidates := make([]int, 0, maxSensorsPerIndividual)

	for sensorCount := 1; sensorCount <= maxSensorsPerIndividual; sensorCount++ {
		count := distribution[sensorCount]
		if count < minCount {
			minCount = count
			candidates = []int{sensorCount}
			continue
		}
		if count == minCount {
			candidates = append(candidates, sensorCount)
		}
	}

	if len(candidates) == 0 {
		return a.sampleSensorCount()
	}

	return candidates[rand.Intn(len(candidates))]
}

func (a *App) injectDiversity() {
	if len(a.points) < 4 || a.generation == 0 || a.generation%diversityInjectionInterval != 0 {
		return
	}

	sort.SliceStable(a.points, func(i int, j int) bool {
		return compareByFitnessDescCostAsc(a.points[i], a.points[j])
	})

	replaceCount := max(1, int(math.Round(float64(len(a.points))*diversityInjectionRatio)))
	elitePoolSize := max(1, int(math.Ceil(float64(len(a.points))*diversityElitePoolRatio)))

	for offset := 0; offset < replaceCount; offset++ {
		targetIndex := len(a.points) - 1 - offset
		if targetIndex < elitePoolSize {
			break
		}

		targetSensorCount := a.leastRepresentedSensorCount()

		if offset%2 == 0 {
			a.points[targetIndex] = a.createRandomIndividual(targetSensorCount)
			continue
		}

		seed := cloneIndividual(a.points[rand.Intn(elitePoolSize)])
		a.rebalanceSensorCount(&seed, targetSensorCount)
		a.applyDiversityShock(&seed)
		a.points[targetIndex] = seed
	}
}

func (a *App) randomSensorPosition(existing []Sensor, sensorRange float64) (float64, float64) {
	for attempt := 0; attempt < maxPlacementAttempts; attempt++ {
		x, y := a.randomAllowedPosition()
		if a.hasLocalSpacingConflict(existing, x, y, sensorRange) {
			continue
		}

		return x, y
	}

	return a.randomAllowedPosition()
}

func (a *App) randomAllowedPosition() (float64, float64) {
	for attempt := 0; attempt < maxAllowedPositionSearchTries; attempt++ {
		x := rand.Float64() * a.config.AreaWidth
		y := rand.Float64() * a.config.AreaHeight
		if a.isSensorPositionAllowed(x, y) {
			return x, y
		}
	}

	return a.config.AreaWidth / 2, a.config.AreaHeight / 2
}

func (a *App) isSensorPositionAllowed(x float64, y float64) bool {
	if x < 0 || y < 0 || x > a.config.AreaWidth || y > a.config.AreaHeight {
		return false
	}

	return !a.isPointBlocked(x, y)
}

func (a *App) hasLocalSpacingConflict(existing []Sensor, x float64, y float64, sensorRange float64) bool {
	for _, current := range existing {
		dx := x - current.X
		dy := y - current.Y
		minDistance := (sensorRange + current.Range) * initialSpacingFactor
		if math.Sqrt(dx*dx+dy*dy) < minDistance {
			return true
		}
	}

	return false
}

func (a *App) getBestFitnessIndividual() Individual {
	if len(a.points) == 0 {
		return Individual{}
	}

	best := a.points[0]
	found := false

	for _, individual := range a.points {
		if individual.Fitness <= 0 {
			continue
		}
		if !found || individual.Fitness > best.Fitness {
			best = individual
			found = true
		}
	}

	if !found {
		return a.points[0]
	}

	return best
}

func (a *App) Evolve() []Individual {
	if len(a.points) == 0 {
		a.InitPopulation()
		return a.points
	}

	a.generation++
	globalBest := a.getBestFitnessIndividual()

	for index := range a.points {
		a.UpdatePositions(&a.points[index], globalBest.Sensors)
		a.CalculateFitness(&a.points[index])

		if a.points[index].Fitness > a.points[index].BestFit {
			a.points[index].BestFit = a.points[index].Fitness
			a.points[index].PBest = append([]Sensor{}, a.points[index].Sensors...)
		}
	}

	a.applyGeneticOperators()
	a.injectDiversity()
	a.UpdateParetoFront()

	return a.points
}
