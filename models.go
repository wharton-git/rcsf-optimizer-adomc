package main

const (
	defaultAreaWidth          = 80.0
	defaultAreaHeight         = 60.0
	defaultPopulation         = 50
	defaultMaxBudget          = 2000000.0
	defaultPriorityZoneWeight = 2.0
)

type Sensor struct {
	ID    int     `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Range float64 `json:"range"`
	Cost  float64 `json:"cost"`
	Type  string  `json:"type"`
}

type Velocity struct {
	VX float64 `json:"VX"`
	VY float64 `json:"VY"`
}

type Individual struct {
	Sensors  []Sensor   `json:"sensors"`
	Velocity []Velocity `json:"velocity"`
	PBest    []Sensor   `json:"pBest"`
	BestFit  float64    `json:"bestFit"`

	Fitness   float64 `json:"fitness"`
	TotalCost float64 `json:"totalCost"`
	IsPareto  bool    `json:"isPareto"`
}

type RectZone struct {
	ID     string  `json:"id"`
	Label  string  `json:"label"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type PriorityZone struct {
	ID     string  `json:"id"`
	Label  string  `json:"label"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	Weight float64 `json:"weight"`
}

type Config struct {
	AreaWidth      float64        `json:"areaWidth"`
	AreaHeight     float64        `json:"areaHeight"`
	Population     int            `json:"population"`
	MaxBudget      float64        `json:"maxBudget"`
	PriorityZones  []PriorityZone `json:"priorityZones"`
	ForbiddenZones []RectZone     `json:"forbiddenZones"`
	ObstacleZones  []RectZone     `json:"obstacleZones"`
	MandatoryZones []RectZone     `json:"mandatoryZones"`
}

type DecisionWeights struct {
	Coverage    float64 `json:"coverage"`
	Cost        float64 `json:"cost"`
	Overlap     float64 `json:"overlap"`
	SensorCount float64 `json:"sensorCount"`
	Robustness  float64 `json:"robustness"`
}

type DecisionScenario struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Weights     DecisionWeights `json:"weights"`
}

type DecisionCriterion struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Goal        string `json:"goal"`
	Description string `json:"description"`
}

type SolutionMetrics struct {
	Coverage               float64 `json:"coverage"`
	Cost                   float64 `json:"cost"`
	Overlap                float64 `json:"overlap"`
	SensorCount            int     `json:"sensorCount"`
	Robustness             float64 `json:"robustness"`
	WorstCaseCoverage      float64 `json:"worstCaseCoverage"`
	AverageFailureCoverage float64 `json:"averageFailureCoverage"`
}

type RankedSolution struct {
	SolutionID       string          `json:"solutionID"`
	Label            string          `json:"label"`
	Individual       Individual      `json:"individual"`
	Metrics          SolutionMetrics `json:"metrics"`
	TOPSISScore      float64         `json:"topsisScore"`
	WeightedSumScore float64         `json:"weightedSumScore"`
	Rank             int             `json:"rank"`
	WeightedSumRank  int             `json:"weightedSumRank"`
	ParetoStatus     bool            `json:"paretoStatus"`
	Explanation      string          `json:"explanation"`
}

type DecisionRequest struct {
	ScenarioID      string          `json:"scenarioID"`
	CandidateSource string          `json:"candidateSource"`
	PrimaryMethod   string          `json:"primaryMethod"`
	Weights         DecisionWeights `json:"weights"`
}

type DecisionAnalysis struct {
	Criteria                         []DecisionCriterion `json:"criteria"`
	Scenario                         DecisionScenario    `json:"scenario"`
	AppliedWeights                   DecisionWeights     `json:"appliedWeights"`
	NormalizedWeights                DecisionWeights     `json:"normalizedWeights"`
	PrimaryMethod                    string              `json:"primaryMethod"`
	BaselineMethod                   string              `json:"baselineMethod"`
	CandidateSource                  string              `json:"candidateSource"`
	RankedSolutions                  []RankedSolution    `json:"rankedSolutions"`
	RecommendedSolutionID            string              `json:"recommendedSolutionID"`
	WeightedSumRecommendedSolutionID string              `json:"weightedSumRecommendedSolutionID"`
	RecommendedExplanation           string              `json:"recommendedExplanation"`
	Summary                          string              `json:"summary"`
}

type DiversityMetrics struct {
	Generation                 int         `json:"generation"`
	PopulationSize             int         `json:"populationSize"`
	SensorCountDistribution    map[int]int `json:"sensorCountDistribution"`
	DistinctSensorCounts       int         `json:"distinctSensorCounts"`
	DistinctMaterialSignatures int         `json:"distinctMaterialSignatures"`
	DistinctStructuralFamilies int         `json:"distinctStructuralFamilies"`
	ParetoBeforeDedup          int         `json:"paretoBeforeDedup"`
	ParetoAfterDedup           int         `json:"paretoAfterDedup"`
	AverageSensorCount         float64     `json:"averageSensorCount"`
	AverageSensorCountGap      float64     `json:"averageSensorCountGap"`
	Summary                    string      `json:"summary"`
}
