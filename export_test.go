package main

import (
	"strings"
	"testing"
)

func sampleDecisionAnalysis() DecisionAnalysis {
	return DecisionAnalysis{
		Scenario: DecisionScenario{
			ID:   "balanced",
			Name: "Equilibre",
		},
		PrimaryMethod:         "TOPSIS",
		CandidateSource:       "pareto",
		RecommendedSolutionID: "sol-1",
		Summary:               "Solution recommandee pour son bon compromis couverture/cout.",
		RankedSolutions: []RankedSolution{
			{
				SolutionID: "sol-1",
				Label:      "Solution 1",
				Metrics: SolutionMetrics{
					Coverage:               91.25,
					Cost:                   180000,
					Overlap:                0.125,
					SensorCount:            3,
					Robustness:             82.5,
					WorstCaseCoverage:      70.5,
					AverageFailureCoverage: 79.4,
				},
				TOPSISScore:      0.84215,
				WeightedSumScore: 0.81124,
				Rank:             1,
				WeightedSumRank:  1,
				ParetoStatus:     true,
				Explanation:      "Compromis solide entre couverture, cout et robustesse.",
			},
		},
	}
}

func TestBuildDecisionCSV(t *testing.T) {
	content, err := buildDecisionCSV(sampleDecisionAnalysis())
	if err != nil {
		t.Fatalf("expected CSV export to succeed, got error: %v", err)
	}

	if !strings.Contains(content, "solution_id") {
		t.Fatalf("expected CSV header to contain solution_id, got: %s", content)
	}

	if !strings.Contains(content, "sol-1") {
		t.Fatalf("expected CSV content to contain exported solution id, got: %s", content)
	}

	if !strings.Contains(content, "Compromis solide entre couverture, cout et robustesse.") {
		t.Fatalf("expected CSV content to contain explanation, got: %s", content)
	}
}

func TestBuildDecisionJSON(t *testing.T) {
	content, err := buildDecisionJSON(sampleDecisionAnalysis())
	if err != nil {
		t.Fatalf("expected JSON export to succeed, got error: %v", err)
	}

	if !strings.Contains(content, "\"recommendedSolutionID\": \"sol-1\"") {
		t.Fatalf("expected JSON to contain recommended solution id, got: %s", content)
	}

	if !strings.Contains(content, "\"rankedSolutions\"") {
		t.Fatalf("expected JSON to contain rankedSolutions, got: %s", content)
	}

	if !strings.Contains(content, "\"topsisScore\": 0.84215") {
		t.Fatalf("expected JSON to contain topsis score, got: %s", content)
	}
}
