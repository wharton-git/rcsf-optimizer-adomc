package main

import (
	"math"
	"math/rand"
	"time"
)

const (
	maxSensorsPerIndividual       = 10
	maxPlacementAttempts          = 10
	maxAllowedPositionSearchTries = 50
	initialVelocityAmplitude      = 1.0
	initialSpacingFactor          = 0.5
)

func (a *App) InitPopulation() {
	rand.Seed(time.Now().UnixNano())
	a.points = make([]Individual, a.config.Population)

	for index := 0; index < a.config.Population; index++ {
		numSensors := rand.Intn(maxSensorsPerIndividual) + 1

		sensors := make([]Sensor, numSensors)
		velocities := make([]Velocity, numSensors)

		for sensorIndex := 0; sensorIndex < numSensors; sensorIndex++ {
			template := SensorCatalog[rand.Intn(len(SensorCatalog))]
			x, y := a.randomSensorPosition(sensors[:sensorIndex], template.Range)

			sensors[sensorIndex] = Sensor{
				ID:    sensorIndex,
				X:     x,
				Y:     y,
				Range: template.Range,
				Cost:  template.Cost,
				Type:  template.Type,
			}

			velocities[sensorIndex] = Velocity{
				VX: rand.Float64()*2*initialVelocityAmplitude - initialVelocityAmplitude,
				VY: rand.Float64()*2*initialVelocityAmplitude - initialVelocityAmplitude,
			}
		}

		individual := Individual{
			Sensors:  sensors,
			Velocity: velocities,
			PBest:    append([]Sensor{}, sensors...),
		}

		a.CalculateFitness(&individual)
		individual.BestFit = individual.Fitness
		a.points[index] = individual
	}

	a.UpdateParetoFront()
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
	a.UpdateParetoFront()

	return a.points
}
