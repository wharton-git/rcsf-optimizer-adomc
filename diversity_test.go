package main

import "testing"

func makeTestIndividual(
	fitness float64,
	cost float64,
	sensors []Sensor,
) Individual {
	return Individual{
		Sensors:   sensors,
		Fitness:   fitness,
		TotalCost: cost,
	}
}

func TestBuildSolutionIDIncludesLayout(t *testing.T) {
	left := makeTestIndividual(80, 90000, []Sensor{
		{Type: "Eco-A", X: 10, Y: 10, Range: 15, Cost: 45000},
		{Type: "Eco-A", X: 20, Y: 20, Range: 15, Cost: 45000},
	})
	right := makeTestIndividual(80, 90000, []Sensor{
		{Type: "Eco-A", X: 30, Y: 30, Range: 15, Cost: 45000},
		{Type: "Eco-A", X: 40, Y: 40, Range: 15, Cost: 45000},
	})

	if buildSolutionID(left) == buildSolutionID(right) {
		t.Fatalf("expected distinct layout-based solution IDs")
	}
}

func TestFilterDistinctSolutionsKeepsLayoutVariants(t *testing.T) {
	first := makeTestIndividual(81.05, 90000, []Sensor{
		{Type: "Eco-A", X: 10, Y: 10, Range: 15, Cost: 45000},
		{Type: "Eco-A", X: 25, Y: 25, Range: 15, Cost: 45000},
	})
	second := makeTestIndividual(81.02, 90000, []Sensor{
		{Type: "Eco-A", X: 55, Y: 45, Range: 15, Cost: 45000},
		{Type: "Eco-A", X: 70, Y: 50, Range: 15, Cost: 45000},
	})

	filtered := filterDistinctSolutions([]Individual{first, second}, 0)
	if len(filtered) != 2 {
		t.Fatalf("expected layout variants to remain visible, got %d solutions", len(filtered))
	}
}

func TestStructuralMutationHelpersRespectBounds(t *testing.T) {
	app := NewApp()
	app.config = sanitizeConfig(Config{
		AreaWidth:  80,
		AreaHeight: 60,
		Population: 10,
		MaxBudget:  2000000,
	})

	single := app.createRandomIndividual(1)
	if app.removeRandomSensor(&single) {
		t.Fatalf("did not expect removal to succeed at minimum sensor count")
	}

	maxed := app.createRandomIndividual(maxSensorsPerIndividual)
	if app.addRandomSensor(&maxed) {
		t.Fatalf("did not expect addition to succeed above sensor limit")
	}

	mid := app.createRandomIndividual(3)
	if !app.addRandomSensor(&mid) {
		t.Fatalf("expected structural addition to succeed")
	}
	if len(mid.Sensors) != 4 {
		t.Fatalf("expected 4 sensors after addition, got %d", len(mid.Sensors))
	}
	if !app.removeRandomSensor(&mid) {
		t.Fatalf("expected structural removal to succeed")
	}
}

func TestBuildDiversityMetricsTracksPopulationShape(t *testing.T) {
	population := []Individual{
		makeTestIndividual(78, 45000, []Sensor{{Type: "Eco-A"}}),
		makeTestIndividual(82, 180000, []Sensor{{Type: "Standard-B"}}),
		makeTestIndividual(88, 225000, []Sensor{
			{Type: "Eco-A"},
			{Type: "Standard-B"},
		}),
	}

	metrics := buildDiversityMetrics(4, population, 5, 3)

	if metrics.PopulationSize != 3 {
		t.Fatalf("expected population size 3, got %d", metrics.PopulationSize)
	}
	if metrics.SensorCountDistribution[1] != 2 || metrics.SensorCountDistribution[2] != 1 {
		t.Fatalf("unexpected sensor count distribution: %#v", metrics.SensorCountDistribution)
	}
	if metrics.DistinctMaterialSignatures != 3 {
		t.Fatalf("expected 3 material signatures, got %d", metrics.DistinctMaterialSignatures)
	}
	if metrics.ParetoBeforeDedup != 5 || metrics.ParetoAfterDedup != 3 {
		t.Fatalf("unexpected pareto counters: %+v", metrics)
	}
}

func TestDiversityMetricsLifecycleLog(t *testing.T) {
	app := NewApp()
	app.config = sanitizeConfig(Config{
		AreaWidth:  80,
		AreaHeight: 60,
		Population: 40,
		MaxBudget:  2000000,
	})

	app.InitPopulation()
	before := app.GetDiversityMetrics()

	for step := 0; step < 10; step++ {
		app.Evolve()
	}

	after := app.GetDiversityMetrics()
	t.Logf("before: %s", before.Summary)
	t.Logf("after:  %s", after.Summary)

	if after.PopulationSize != app.config.Population {
		t.Fatalf("expected population size %d, got %d", app.config.Population, after.PopulationSize)
	}
	if after.ParetoAfterDedup <= 0 {
		t.Fatalf("expected at least one Pareto solution after evolution")
	}
}
