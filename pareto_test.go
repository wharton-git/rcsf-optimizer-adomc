package main

import "testing"

func TestDominates(t *testing.T) {
	better := Individual{Fitness: 82, TotalCost: 120000}
	worse := Individual{Fitness: 75, TotalCost: 150000}
	sameFitnessLowerCost := Individual{Fitness: 82, TotalCost: 100000}

	if !dominates(better, worse) {
		t.Fatalf("expected %+v to dominate %+v", better, worse)
	}

	if dominates(worse, better) {
		t.Fatalf("did not expect %+v to dominate %+v", worse, better)
	}

	if !dominates(sameFitnessLowerCost, better) {
		t.Fatalf("expected lower-cost solution with same fitness to dominate")
	}
}
