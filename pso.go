package main

import (
	"math"
	"math/rand"
)

const (
	psoInertiaWeight     = 0.7
	psoCognitiveWeight   = 1.5
	psoSocialWeight      = 1.5
	psoRepulsionStrength = 5.0
	psoSpacingFactor     = 0.5
)

func (a *App) UpdatePositions(individual *Individual, globalBest []Sensor) {
	for index := range individual.Sensors {
		if index >= len(globalBest) || index >= len(individual.PBest) {
			break
		}

		randomCognitive := rand.Float64()
		randomSocial := rand.Float64()

		repulsionX, repulsionY := 0.0, 0.0
		for otherIndex := range individual.Sensors {
			if index == otherIndex {
				continue
			}

			dx := individual.Sensors[index].X - individual.Sensors[otherIndex].X
			dy := individual.Sensors[index].Y - individual.Sensors[otherIndex].Y
			distance := math.Sqrt(dx*dx+dy*dy) + 0.001
			minDistance := (individual.Sensors[index].Range + individual.Sensors[otherIndex].Range) * psoSpacingFactor

			if distance < minDistance {
				repulsionX += (dx / distance) * (minDistance - distance) * psoRepulsionStrength
				repulsionY += (dy / distance) * (minDistance - distance) * psoRepulsionStrength
			}
		}

		individual.Velocity[index].VX =
			psoInertiaWeight*individual.Velocity[index].VX +
				psoCognitiveWeight*randomCognitive*(individual.PBest[index].X-individual.Sensors[index].X) +
				psoSocialWeight*randomSocial*(globalBest[index].X-individual.Sensors[index].X) +
				repulsionX

		individual.Velocity[index].VY =
			psoInertiaWeight*individual.Velocity[index].VY +
				psoCognitiveWeight*randomCognitive*(individual.PBest[index].Y-individual.Sensors[index].Y) +
				psoSocialWeight*randomSocial*(globalBest[index].Y-individual.Sensors[index].Y) +
				repulsionY

		nextX := math.Max(0, math.Min(a.config.AreaWidth, individual.Sensors[index].X+individual.Velocity[index].VX))
		nextY := math.Max(0, math.Min(a.config.AreaHeight, individual.Sensors[index].Y+individual.Velocity[index].VY))

		if !a.isSensorPositionAllowed(nextX, nextY) {
			nextX, nextY = a.randomAllowedPosition()
		}

		individual.Sensors[index].X = nextX
		individual.Sensors[index].Y = nextY
	}
}
