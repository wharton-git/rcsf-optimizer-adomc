package main

import "testing"

func TestComputeOverlapPenalty(t *testing.T) {
	overlapping := []Sensor{
		{X: 0, Y: 0, Range: 50},
		{X: 10, Y: 0, Range: 50},
	}
	separated := []Sensor{
		{X: 0, Y: 0, Range: 20},
		{X: 100, Y: 100, Range: 20},
	}

	if computeOverlapPenalty(separated) != 0 {
		t.Fatalf("expected no overlap penalty for separated sensors")
	}

	if computeOverlapPenalty(overlapping) <= 0 {
		t.Fatalf("expected positive overlap penalty for overlapping sensors")
	}
}

func TestComputeRobustnessScore(t *testing.T) {
	app := NewApp()
	app.config = sanitizeConfig(Config{
		AreaWidth:  20,
		AreaHeight: 20,
		Population: 10,
		MaxBudget:  1000000,
	})

	singleSensor := []Sensor{
		{X: 10, Y: 10, Range: 100},
	}
	redundantSensors := []Sensor{
		{X: 10, Y: 10, Range: 100},
		{X: 10, Y: 10, Range: 100},
	}

	singleRobustness, _, _ := app.computeRobustnessScore(singleSensor)
	redundantRobustness, _, _ := app.computeRobustnessScore(redundantSensors)

	if singleRobustness != 0 {
		t.Fatalf("expected single-sensor robustness to be 0, got %.2f", singleRobustness)
	}

	if redundantRobustness < 99.9 {
		t.Fatalf("expected redundant deployment to preserve coverage, got %.2f", redundantRobustness)
	}
}
