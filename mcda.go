package main

import (
	"fmt"
	"math"
	"sort"
)

const (
	goalMaximize = "maximize"
	goalMinimize = "minimize"
)

type decisionCandidate struct {
	solutionID string
	individual Individual
	metrics    SolutionMetrics
}

func getDecisionCriteria() []DecisionCriterion {
	return []DecisionCriterion{
		{
			ID:          "coverage",
			Label:       "Couverture",
			Goal:        goalMaximize,
			Description: "Pourcentage de couverture de la zone, en tenant compte des zones prioritaires.",
		},
		{
			ID:          "cost",
			Label:       "Cout total",
			Goal:        goalMinimize,
			Description: "Cout total des capteurs deployes.",
		},
		{
			ID:          "overlap",
			Label:       "Chevauchement",
			Goal:        goalMinimize,
			Description: "Redondance inutile mesuree par la proximite excessive entre capteurs.",
		},
		{
			ID:          "sensor_count",
			Label:       "Nombre de capteurs",
			Goal:        goalMinimize,
			Description: "Complexite d'installation et de maintenance du reseau.",
		},
		{
			ID:          "robustness",
			Label:       "Robustesse",
			Goal:        goalMaximize,
			Description: "Couverture retenue dans le pire cas de panne d'un capteur.",
		},
	}
}

func sumWeights(weights DecisionWeights) float64 {
	return weights.Coverage +
		weights.Cost +
		weights.Overlap +
		weights.SensorCount +
		weights.Robustness
}

func normalizeWeights(weights DecisionWeights) DecisionWeights {
	total := sumWeights(weights)
	if total <= 0 {
		return defaultDecisionScenario().Weights
	}

	return DecisionWeights{
		Coverage:    weights.Coverage / total,
		Cost:        weights.Cost / total,
		Overlap:     weights.Overlap / total,
		SensorCount: weights.SensorCount / total,
		Robustness:  weights.Robustness / total,
	}
}

func resolveDecisionScenario(request DecisionRequest) (DecisionScenario, DecisionWeights, string) {
	candidateSource := request.CandidateSource
	if candidateSource != candidateSourceValid {
		candidateSource = candidateSourcePareto
	}

	if request.ScenarioID == manualDecisionScenarioID {
		appliedWeights := request.Weights
		if sumWeights(appliedWeights) <= 0 {
			appliedWeights = defaultDecisionScenario().Weights
		}

		return DecisionScenario{
			ID:          manualDecisionScenarioID,
			Name:        "Personnalise",
			Description: "Ponderation definie manuellement par l'utilisateur.",
			Weights:     appliedWeights,
		}, appliedWeights, candidateSource
	}

	scenario, found := getDecisionScenarioByID(request.ScenarioID)
	if !found {
		scenario = defaultDecisionScenario()
	}

	appliedWeights := request.Weights
	if sumWeights(appliedWeights) <= 0 {
		appliedWeights = scenario.Weights
	}

	return scenario, appliedWeights, candidateSource
}

func (a *App) collectDecisionCandidates(source string) []Individual {
	validCandidates := make([]Individual, 0, len(a.points))
	paretoCandidates := make([]Individual, 0, len(a.points))

	for _, individual := range a.points {
		if individual.Fitness <= 0 {
			continue
		}

		validCandidates = append(validCandidates, individual)
		if individual.IsPareto {
			paretoCandidates = append(paretoCandidates, individual)
		}
	}

	sort.Slice(validCandidates, func(i int, j int) bool {
		return compareByFitnessDescCostAsc(validCandidates[i], validCandidates[j])
	})
	validCandidates = filterDistinctSolutions(validCandidates, 0)

	sort.Slice(paretoCandidates, func(i int, j int) bool {
		return compareByScoreDesc(paretoCandidates[i], paretoCandidates[j])
	})
	paretoCandidates = filterDistinctSolutions(paretoCandidates, 0)

	if source == candidateSourceValid || len(paretoCandidates) == 0 {
		return validCandidates
	}

	return paretoCandidates
}

func decisionCriterionValue(metrics SolutionMetrics, criterionID string) float64 {
	switch criterionID {
	case "coverage":
		return metrics.Coverage
	case "cost":
		return metrics.Cost
	case "overlap":
		return metrics.Overlap
	case "sensor_count":
		return float64(metrics.SensorCount)
	case "robustness":
		return metrics.Robustness
	default:
		return 0
	}
}

func weightForCriterion(weights DecisionWeights, criterionID string) float64 {
	switch criterionID {
	case "coverage":
		return weights.Coverage
	case "cost":
		return weights.Cost
	case "overlap":
		return weights.Overlap
	case "sensor_count":
		return weights.SensorCount
	case "robustness":
		return weights.Robustness
	default:
		return 0
	}
}

func prepareDecisionCandidates(app *App, candidates []Individual) []decisionCandidate {
	prepared := make([]decisionCandidate, 0, len(candidates))
	for _, individual := range candidates {
		prepared = append(prepared, decisionCandidate{
			solutionID: buildSolutionID(individual),
			individual: individual,
			metrics:    app.buildSolutionMetrics(individual),
		})
	}

	return prepared
}

func computeTopsisScores(candidates []decisionCandidate, weights DecisionWeights) map[string]float64 {
	criteria := getDecisionCriteria()
	scores := make(map[string]float64, len(candidates))
	if len(candidates) == 0 {
		return scores
	}

	denominators := map[string]float64{}
	for _, criterion := range criteria {
		sumSquares := 0.0
		for _, candidate := range candidates {
			value := decisionCriterionValue(candidate.metrics, criterion.ID)
			sumSquares += value * value
		}
		denominators[criterion.ID] = math.Sqrt(sumSquares)
	}

	idealBest := map[string]float64{}
	idealWorst := map[string]float64{}
	for _, criterion := range criteria {
		idealBest[criterion.ID] = 0
		idealWorst[criterion.ID] = 0
	}

	weightedNormalizedValues := make(map[string]map[string]float64, len(candidates))
	for _, candidate := range candidates {
		candidateValues := map[string]float64{}
		for _, criterion := range criteria {
			value := decisionCriterionValue(candidate.metrics, criterion.ID)
			normalizedValue := 0.0
			if denominators[criterion.ID] > 0 {
				normalizedValue = value / denominators[criterion.ID]
			}
			weightedValue := normalizedValue * weightForCriterion(weights, criterion.ID)
			candidateValues[criterion.ID] = weightedValue
		}
		weightedNormalizedValues[candidate.solutionID] = candidateValues
	}

	for _, criterion := range criteria {
		firstValue := weightedNormalizedValues[candidates[0].solutionID][criterion.ID]
		idealBest[criterion.ID] = firstValue
		idealWorst[criterion.ID] = firstValue

		for _, candidate := range candidates[1:] {
			value := weightedNormalizedValues[candidate.solutionID][criterion.ID]
			if criterion.Goal == goalMaximize {
				idealBest[criterion.ID] = math.Max(idealBest[criterion.ID], value)
				idealWorst[criterion.ID] = math.Min(idealWorst[criterion.ID], value)
			} else {
				idealBest[criterion.ID] = math.Min(idealBest[criterion.ID], value)
				idealWorst[criterion.ID] = math.Max(idealWorst[criterion.ID], value)
			}
		}
	}

	for _, candidate := range candidates {
		distanceToBest := 0.0
		distanceToWorst := 0.0

		for _, criterion := range criteria {
			value := weightedNormalizedValues[candidate.solutionID][criterion.ID]
			distanceToBest += math.Pow(value-idealBest[criterion.ID], 2)
			distanceToWorst += math.Pow(value-idealWorst[criterion.ID], 2)
		}

		distanceToBest = math.Sqrt(distanceToBest)
		distanceToWorst = math.Sqrt(distanceToWorst)

		if distanceToBest+distanceToWorst == 0 {
			scores[candidate.solutionID] = 0
			continue
		}

		scores[candidate.solutionID] = distanceToWorst / (distanceToBest + distanceToWorst)
	}

	return scores
}

func computeWeightedSumScores(candidates []decisionCandidate, weights DecisionWeights) map[string]float64 {
	criteria := getDecisionCriteria()
	scores := make(map[string]float64, len(candidates))
	if len(candidates) == 0 {
		return scores
	}

	minValues := map[string]float64{}
	maxValues := map[string]float64{}

	for _, criterion := range criteria {
		firstValue := decisionCriterionValue(candidates[0].metrics, criterion.ID)
		minValues[criterion.ID] = firstValue
		maxValues[criterion.ID] = firstValue

		for _, candidate := range candidates[1:] {
			value := decisionCriterionValue(candidate.metrics, criterion.ID)
			minValues[criterion.ID] = math.Min(minValues[criterion.ID], value)
			maxValues[criterion.ID] = math.Max(maxValues[criterion.ID], value)
		}
	}

	for _, candidate := range candidates {
		totalScore := 0.0

		for _, criterion := range criteria {
			value := decisionCriterionValue(candidate.metrics, criterion.ID)
			minValue := minValues[criterion.ID]
			maxValue := maxValues[criterion.ID]

			normalizedValue := 1.0
			if maxValue-minValue > 0 {
				if criterion.Goal == goalMaximize {
					normalizedValue = (value - minValue) / (maxValue - minValue)
				} else {
					normalizedValue = (maxValue - value) / (maxValue - minValue)
				}
			}

			totalScore += normalizedValue * weightForCriterion(weights, criterion.ID)
		}

		scores[candidate.solutionID] = totalScore
	}

	return scores
}

func rankByScore(
	candidates []decisionCandidate,
	scores map[string]float64,
	fallbackScores map[string]float64,
) []decisionCandidate {
	ranked := append([]decisionCandidate{}, candidates...)

	sort.SliceStable(ranked, func(i int, j int) bool {
		leftScore := scores[ranked[i].solutionID]
		rightScore := scores[ranked[j].solutionID]

		if math.Abs(leftScore-rightScore) > 1e-12 {
			return leftScore > rightScore
		}

		if fallbackScores != nil {
			leftFallback := fallbackScores[ranked[i].solutionID]
			rightFallback := fallbackScores[ranked[j].solutionID]
			if math.Abs(leftFallback-rightFallback) > 1e-12 {
				return leftFallback > rightFallback
			}
		}

		return compareByFitnessDescCostAsc(ranked[i].individual, ranked[j].individual)
	})

	return ranked
}

func buildWeightedSumRanks(ranked []decisionCandidate) map[string]int {
	ranks := make(map[string]int, len(ranked))
	for index, candidate := range ranked {
		ranks[candidate.solutionID] = index + 1
	}

	return ranks
}

func joinNaturalList(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	if len(parts) == 1 {
		return parts[0]
	}
	if len(parts) == 2 {
		return parts[0] + " et " + parts[1]
	}

	joined := ""
	for index, part := range parts {
		if index == len(parts)-1 {
			joined += "et " + part
			break
		}
		joined += part + ", "
	}

	return joined
}

func buildExplanationContext(ranked []RankedSolution) SolutionMetrics {
	if len(ranked) == 0 {
		return SolutionMetrics{}
	}

	context := ranked[0].Metrics
	for _, solution := range ranked[1:] {
		context.Coverage = math.Max(context.Coverage, solution.Metrics.Coverage)
		context.Cost = math.Min(context.Cost, solution.Metrics.Cost)
		context.Overlap = math.Min(context.Overlap, solution.Metrics.Overlap)
		context.SensorCount = min(context.SensorCount, solution.Metrics.SensorCount)
		context.Robustness = math.Max(context.Robustness, solution.Metrics.Robustness)
	}

	return context
}

func buildSolutionExplanation(
	solution RankedSolution,
	context SolutionMetrics,
	scenario DecisionScenario,
) string {
	strengths := make([]string, 0, 4)
	tradeoffs := make([]string, 0, 2)

	if solution.Metrics.Coverage >= context.Coverage*0.95 {
		strengths = append(strengths, fmt.Sprintf("une couverture elevee de %.1f%%", solution.Metrics.Coverage))
	}
	if solution.Metrics.Cost <= context.Cost*1.10 {
		strengths = append(strengths, fmt.Sprintf("un cout contenu de %.0f Ar", solution.Metrics.Cost))
	}
	if solution.Metrics.Overlap <= context.Overlap+0.05 {
		strengths = append(strengths, "peu de redondance inutile")
	}
	if solution.Metrics.SensorCount <= context.SensorCount+1 {
		strengths = append(strengths, fmt.Sprintf("un reseau compact de %d capteur(s)", solution.Metrics.SensorCount))
	}
	if solution.Metrics.Robustness >= context.Robustness*0.90 {
		strengths = append(strengths, fmt.Sprintf("une robustesse correcte de %.1f%%", solution.Metrics.Robustness))
	}

	if len(strengths) == 0 {
		strengths = append(strengths, "un compromis global defendable")
	}

	if solution.Metrics.Cost > context.Cost*1.25 {
		tradeoffs = append(tradeoffs, "un cout plus eleve que les options les moins cheres")
	}
	if solution.Metrics.SensorCount > context.SensorCount+2 {
		tradeoffs = append(tradeoffs, "un dispositif plus dense a maintenir")
	}
	if solution.Metrics.Robustness < context.Robustness*0.75 {
		tradeoffs = append(tradeoffs, "une tenue a la panne plus faible que les meilleures alternatives")
	}

	explanation := fmt.Sprintf(
		"Cette solution est bien classee pour le scenario %s grace a %s.",
		scenario.Name,
		joinNaturalList(strengths),
	)

	if len(tradeoffs) > 0 {
		explanation += " Son principal compromis reste " + joinNaturalList(tradeoffs) + "."
	}

	return explanation
}

func buildRecommendationSummary(
	analysis DecisionAnalysis,
	recommended RankedSolution,
	second *RankedSolution,
) string {
	summary := fmt.Sprintf(
		"La solution recommandee est %s car elle obtient le meilleur score TOPSIS (%.3f) pour le scenario %s.",
		recommended.Label,
		recommended.TOPSISScore,
		analysis.Scenario.Name,
	)

	if second != nil {
		summary += fmt.Sprintf(
			" Elle devance %s (%.3f) avec un meilleur compromis entre couverture, cout et robustesse.",
			second.Label,
			second.TOPSISScore,
		)
	}

	if analysis.WeightedSumRecommendedSolutionID != "" &&
		analysis.WeightedSumRecommendedSolutionID != analysis.RecommendedSolutionID {
		summary += " La somme ponderee de reference recommande une autre solution, ce qui rend la comparaison methodologique plus interessante en soutenance."
	}

	return summary
}

func (a *App) analyzeDecision(request DecisionRequest) DecisionAnalysis {
	scenario, appliedWeights, candidateSource := resolveDecisionScenario(request)
	normalizedWeights := normalizeWeights(appliedWeights)
	candidates := a.collectDecisionCandidates(candidateSource)
	preparedCandidates := prepareDecisionCandidates(a, candidates)

	topsisScores := computeTopsisScores(preparedCandidates, normalizedWeights)
	weightedSumScores := computeWeightedSumScores(preparedCandidates, normalizedWeights)

	topsisRanking := rankByScore(preparedCandidates, topsisScores, weightedSumScores)
	weightedSumRanking := rankByScore(preparedCandidates, weightedSumScores, topsisScores)
	weightedSumRanks := buildWeightedSumRanks(weightedSumRanking)

	analysis := DecisionAnalysis{
		Criteria:          getDecisionCriteria(),
		Scenario:          scenario,
		AppliedWeights:    appliedWeights,
		NormalizedWeights: normalizedWeights,
		PrimaryMethod:     primaryMethodTOPSIS,
		BaselineMethod:    baselineMethodWeightedSum,
		CandidateSource:   candidateSource,
		RankedSolutions:   []RankedSolution{},
	}

	for index, candidate := range topsisRanking {
		analysis.RankedSolutions = append(analysis.RankedSolutions, RankedSolution{
			SolutionID:       candidate.solutionID,
			Label:            fmt.Sprintf("SOL-%02d", index+1),
			Individual:       candidate.individual,
			Metrics:          candidate.metrics,
			TOPSISScore:      topsisScores[candidate.solutionID],
			WeightedSumScore: weightedSumScores[candidate.solutionID],
			Rank:             index + 1,
			WeightedSumRank:  weightedSumRanks[candidate.solutionID],
			ParetoStatus:     candidate.individual.IsPareto,
		})
	}

	context := buildExplanationContext(analysis.RankedSolutions)
	for index := range analysis.RankedSolutions {
		analysis.RankedSolutions[index].Explanation = buildSolutionExplanation(
			analysis.RankedSolutions[index],
			context,
			scenario,
		)
	}

	if len(analysis.RankedSolutions) == 0 {
		analysis.RecommendedExplanation = "Aucune solution valide n'est disponible pour la decision multicritere."
		analysis.Summary = analysis.RecommendedExplanation
		return analysis
	}

	recommended := analysis.RankedSolutions[0]
	analysis.RecommendedSolutionID = recommended.SolutionID
	analysis.RecommendedExplanation = recommended.Explanation
	if len(weightedSumRanking) > 0 {
		analysis.WeightedSumRecommendedSolutionID = weightedSumRanking[0].solutionID
	}

	var second *RankedSolution
	if len(analysis.RankedSolutions) > 1 {
		second = &analysis.RankedSolutions[1]
	}

	analysis.Summary = buildRecommendationSummary(analysis, recommended, second)

	return analysis
}
