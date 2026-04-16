package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"strconv"
)

func buildDecisionCSV(analysis DecisionAnalysis) (string, error) {
	buffer := &bytes.Buffer{}
	writer := csv.NewWriter(buffer)

	header := []string{
		"label",
		"solution_id",
		"rank",
		"pareto_status",
		"coverage_percent",
		"cost_ariary",
		"overlap",
		"sensor_count",
		"robustness_percent",
		"worst_case_coverage_percent",
		"average_failure_coverage_percent",
		"topsis_score",
		"weighted_sum_score",
		"weighted_sum_rank",
		"explanation",
	}
	if err := writer.Write(header); err != nil {
		return "", err
	}

	for _, solution := range analysis.RankedSolutions {
		row := []string{
			solution.Label,
			solution.SolutionID,
			strconv.Itoa(solution.Rank),
			strconv.FormatBool(solution.ParetoStatus),
			strconv.FormatFloat(solution.Metrics.Coverage, 'f', 3, 64),
			strconv.FormatFloat(solution.Metrics.Cost, 'f', 2, 64),
			strconv.FormatFloat(solution.Metrics.Overlap, 'f', 5, 64),
			strconv.Itoa(solution.Metrics.SensorCount),
			strconv.FormatFloat(solution.Metrics.Robustness, 'f', 3, 64),
			strconv.FormatFloat(solution.Metrics.WorstCaseCoverage, 'f', 3, 64),
			strconv.FormatFloat(solution.Metrics.AverageFailureCoverage, 'f', 3, 64),
			strconv.FormatFloat(solution.TOPSISScore, 'f', 6, 64),
			strconv.FormatFloat(solution.WeightedSumScore, 'f', 6, 64),
			strconv.Itoa(solution.WeightedSumRank),
			solution.Explanation,
		}

		if err := writer.Write(row); err != nil {
			return "", err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", err
	}

	return buffer.String(), nil
}

func buildDecisionJSON(analysis DecisionAnalysis) (string, error) {
	content, err := json.MarshalIndent(analysis, "", "  ")
	if err != nil {
		return "", err
	}

	return string(content), nil
}
