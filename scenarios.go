package main

const (
	defaultDecisionScenarioID = "balanced"
	manualDecisionScenarioID  = "manual"
	candidateSourcePareto     = "pareto"
	candidateSourceValid      = "valid"
	primaryMethodTOPSIS       = "topsis"
	baselineMethodWeightedSum = "weighted_sum"
)

var decisionScenarios = []DecisionScenario{
	{
		ID:          "economic",
		Name:        "Economique",
		Description: "Privilegie le cout et la simplicite d'installation.",
		Weights: DecisionWeights{
			Coverage: 0.20, Cost: 0.35, Overlap: 0.15, SensorCount: 0.20, Robustness: 0.10,
		},
	},
	{
		ID:          defaultDecisionScenarioID,
		Name:        "Equilibre",
		Description: "Recherche un compromis defendable entre couverture, cout et robustesse.",
		Weights: DecisionWeights{
			Coverage: 0.30, Cost: 0.25, Overlap: 0.15, SensorCount: 0.10, Robustness: 0.20,
		},
	},
	{
		ID:          "max_coverage",
		Name:        "Couverture maximale",
		Description: "Favorise au maximum la couverture, tout en gardant une robustesse correcte.",
		Weights: DecisionWeights{
			Coverage: 0.45, Cost: 0.15, Overlap: 0.10, SensorCount: 0.05, Robustness: 0.25,
		},
	},
	{
		ID:          "robust",
		Name:        "Robuste",
		Description: "Priorise la tenue du reseau apres la panne d'un capteur.",
		Weights: DecisionWeights{
			Coverage: 0.20, Cost: 0.10, Overlap: 0.10, SensorCount: 0.10, Robustness: 0.50,
		},
	},
	{
		ID:          "low_maintenance",
		Name:        "Maintenance minimale",
		Description: "Cherche a limiter le nombre de capteurs et la redondance inutile.",
		Weights: DecisionWeights{
			Coverage: 0.20, Cost: 0.20, Overlap: 0.20, SensorCount: 0.30, Robustness: 0.10,
		},
	},
}

func getDecisionScenarios() []DecisionScenario {
	cloned := make([]DecisionScenario, len(decisionScenarios))
	copy(cloned, decisionScenarios)
	return cloned
}

func getDecisionScenarioByID(id string) (DecisionScenario, bool) {
	for _, scenario := range decisionScenarios {
		if scenario.ID == id {
			return scenario, true
		}
	}

	return DecisionScenario{}, false
}

func defaultDecisionScenario() DecisionScenario {
	scenario, found := getDecisionScenarioByID(defaultDecisionScenarioID)
	if found {
		return scenario
	}

	return decisionScenarios[0]
}
