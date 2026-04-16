package main

import "testing"

func makeDecisionCandidate(
	id string,
	coverage float64,
	cost float64,
	overlap float64,
	sensorCount int,
	robustness float64,
) decisionCandidate {
	return decisionCandidate{
		solutionID: id,
		metrics: SolutionMetrics{
			Coverage:    coverage,
			Cost:        cost,
			Overlap:     overlap,
			SensorCount: sensorCount,
			Robustness:  robustness,
		},
	}
}

func TestComputeTopsisScores(t *testing.T) {
	candidates := []decisionCandidate{
		makeDecisionCandidate("A", 92, 150000, 0.10, 3, 88),
		makeDecisionCandidate("B", 75, 120000, 0.30, 4, 55),
	}

	weights := normalizeWeights(DecisionWeights{
		Coverage: 0.45, Cost: 0.10, Overlap: 0.10, SensorCount: 0.05, Robustness: 0.30,
	})

	scores := computeTopsisScores(candidates, weights)
	if scores["A"] <= scores["B"] {
		t.Fatalf("expected candidate A to outrank B with coverage/robustness-focused weights: %#v", scores)
	}
}

func TestRankByScoreIsStable(t *testing.T) {
	candidates := []decisionCandidate{
		makeDecisionCandidate("A", 90, 140000, 0.10, 3, 85),
		makeDecisionCandidate("B", 88, 110000, 0.05, 2, 72),
		makeDecisionCandidate("C", 70, 90000, 0.08, 2, 60),
	}

	weights := normalizeWeights(DecisionWeights{
		Coverage: 0.30, Cost: 0.25, Overlap: 0.15, SensorCount: 0.10, Robustness: 0.20,
	})

	topsisScores := computeTopsisScores(candidates, weights)
	weightedSumScores := computeWeightedSumScores(candidates, weights)

	firstRanking := rankByScore(candidates, topsisScores, weightedSumScores)
	secondRanking := rankByScore(candidates, topsisScores, weightedSumScores)

	if len(firstRanking) != len(secondRanking) {
		t.Fatalf("expected identical ranking lengths")
	}

	for index := range firstRanking {
		if firstRanking[index].solutionID != secondRanking[index].solutionID {
			t.Fatalf("ranking order is not stable at index %d: %s vs %s", index, firstRanking[index].solutionID, secondRanking[index].solutionID)
		}
	}
}
