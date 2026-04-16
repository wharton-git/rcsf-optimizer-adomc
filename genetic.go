package main

import (
	"math/rand"
	"sort"
)

const (
	geneticEliteRatio         = 0.2
	tournamentRounds          = 3
	positionMutationChance    = 0.2
	typeMutationChance        = 0.1
	positionMutationAmplitude = 10.0
)

func (a *App) applyGeneticOperators() {
	sort.Slice(a.points, func(i int, j int) bool {
		return a.points[i].Fitness > a.points[j].Fitness
	})

	eliteSize := int(geneticEliteRatio * float64(len(a.points)))
	if eliteSize < 1 {
		eliteSize = 1
	}

	newPopulation := append([]Individual{}, a.points[:eliteSize]...)

	for len(newPopulation) < len(a.points) {
		parentOne := a.tournamentSelect()
		parentTwo := a.tournamentSelect()

		child := crossover(parentOne, parentTwo)
		a.mutate(&child)

		child.Velocity = make([]Velocity, len(child.Sensors))
		for index := range child.Velocity {
			child.Velocity[index] = Velocity{
				VX: rand.Float64()*2*initialVelocityAmplitude - initialVelocityAmplitude,
				VY: rand.Float64()*2*initialVelocityAmplitude - initialVelocityAmplitude,
			}
		}

		child.PBest = append([]Sensor{}, child.Sensors...)
		a.CalculateFitness(&child)
		child.BestFit = child.Fitness

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

func crossover(parentOne Individual, parentTwo Individual) Individual {
	child := Individual{}
	maxSensors := max(len(parentOne.Sensors), len(parentTwo.Sensors))

	for index := 0; index < maxSensors; index++ {
		if rand.Float64() < 0.5 && index < len(parentOne.Sensors) {
			child.Sensors = append(child.Sensors, parentOne.Sensors[index])
		} else if index < len(parentTwo.Sensors) {
			child.Sensors = append(child.Sensors, parentTwo.Sensors[index])
		}
	}

	return child
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
}
