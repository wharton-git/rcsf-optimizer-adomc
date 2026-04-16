package main

import (
	"context"
	"fmt"
)

type App struct {
	ctx    context.Context
	config Config
	points []Individual
}

var defaultSensorCatalog = []Sensor{
	{Type: "Eco-A", Range: 15, Cost: 45000},
	{Type: "Standard-B", Range: 50, Cost: 180000},
	{Type: "Premium-C", Range: 120, Cost: 650000},
}

var SensorCatalog = cloneSensorCatalog(defaultSensorCatalog)

func cloneSensorCatalog(catalog []Sensor) []Sensor {
	cloned := make([]Sensor, len(catalog))
	copy(cloned, catalog)
	return cloned
}

func defaultConfig() Config {
	return Config{
		AreaWidth:      defaultAreaWidth,
		AreaHeight:     defaultAreaHeight,
		Population:     defaultPopulation,
		MaxBudget:      defaultMaxBudget,
		PriorityZones:  []PriorityZone{},
		ForbiddenZones: []RectZone{},
		ObstacleZones:  []RectZone{},
		MandatoryZones: []RectZone{},
	}
}

func sanitizeConfig(config Config) Config {
	sanitized := config

	if sanitized.AreaWidth <= 0 {
		sanitized.AreaWidth = defaultAreaWidth
	}
	if sanitized.AreaHeight <= 0 {
		sanitized.AreaHeight = defaultAreaHeight
	}
	if sanitized.Population <= 0 {
		sanitized.Population = defaultPopulation
	}
	if sanitized.MaxBudget <= 0 {
		sanitized.MaxBudget = defaultMaxBudget
	}

	sanitized.PriorityZones = sanitizePriorityZones(
		sanitized.PriorityZones,
		sanitized.AreaWidth,
		sanitized.AreaHeight,
	)
	sanitized.ForbiddenZones = sanitizeRectZones(
		sanitized.ForbiddenZones,
		sanitized.AreaWidth,
		sanitized.AreaHeight,
	)
	sanitized.ObstacleZones = sanitizeRectZones(
		sanitized.ObstacleZones,
		sanitized.AreaWidth,
		sanitized.AreaHeight,
	)
	sanitized.MandatoryZones = sanitizeRectZones(
		sanitized.MandatoryZones,
		sanitized.AreaWidth,
		sanitized.AreaHeight,
	)

	return sanitized
}

func sanitizePriorityZones(zones []PriorityZone, areaWidth float64, areaHeight float64) []PriorityZone {
	sanitized := make([]PriorityZone, 0, len(zones))

	for index, zone := range zones {
		if zone.Label == "" {
			zone.Label = fmt.Sprintf("Zone %d", index+1)
		}
		if zone.ID == "" {
			zone.ID = fmt.Sprintf("priority-%d", index+1)
		}
		if zone.Weight <= 0 {
			zone.Weight = defaultPriorityZoneWeight
		}

		normalizedRect := sanitizeRectZone(
			RectZone{
				ID:     zone.ID,
				Label:  zone.Label,
				X:      zone.X,
				Y:      zone.Y,
				Width:  zone.Width,
				Height: zone.Height,
			},
			areaWidth,
			areaHeight,
		)

		zone.X = normalizedRect.X
		zone.Y = normalizedRect.Y
		zone.Width = normalizedRect.Width
		zone.Height = normalizedRect.Height

		sanitized = append(sanitized, zone)
	}

	return sanitized
}

func sanitizeRectZones(zones []RectZone, areaWidth float64, areaHeight float64) []RectZone {
	sanitized := make([]RectZone, 0, len(zones))

	for index, zone := range zones {
		if zone.Label == "" {
			zone.Label = fmt.Sprintf("Zone %d", index+1)
		}
		if zone.ID == "" {
			zone.ID = fmt.Sprintf("zone-%d", index+1)
		}

		sanitized = append(sanitized, sanitizeRectZone(zone, areaWidth, areaHeight))
	}

	return sanitized
}

func sanitizeRectZone(zone RectZone, areaWidth float64, areaHeight float64) RectZone {
	if zone.Width < 0 {
		zone.Width = 0
	}
	if zone.Height < 0 {
		zone.Height = 0
	}

	if zone.X < 0 {
		zone.X = 0
	}
	if zone.Y < 0 {
		zone.Y = 0
	}

	if zone.X+zone.Width > areaWidth {
		zone.Width = max(0, areaWidth-zone.X)
	}
	if zone.Y+zone.Height > areaHeight {
		zone.Height = max(0, areaHeight-zone.Y)
	}

	return zone
}

func sanitizeCatalog(newCatalog []Sensor) []Sensor {
	if len(newCatalog) == 0 {
		return cloneSensorCatalog(defaultSensorCatalog)
	}

	sanitized := make([]Sensor, 0, len(newCatalog))

	for index, sensor := range newCatalog {
		if sensor.Type == "" {
			sensor.Type = fmt.Sprintf("Sensor-%d", index+1)
		}
		if sensor.Range <= 0 {
			sensor.Range = 1
		}
		if sensor.Cost < 0 {
			sensor.Cost = 0
		}

		sensor.ID = index
		sanitized = append(sanitized, sensor)
	}

	return sanitized
}

func NewApp() *App {
	return &App{
		config: defaultConfig(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) SetConstraints(config Config) {
	a.config = sanitizeConfig(config)
	a.InitPopulation()
}

func (a *App) GetConfig() Config {
	return a.config
}

func (a *App) UpdateCatalog(newCatalog []Sensor) {
	SensorCatalog = sanitizeCatalog(newCatalog)
	a.InitPopulation()
}

func (a *App) GetCatalog() []Sensor {
	return cloneSensorCatalog(SensorCatalog)
}

func (a *App) GetAllSolutions() []Individual {
	return a.points
}

func (a *App) GetOptimalSolutions(limit int) []Individual {
	candidates := a.collectDecisionCandidates(candidateSourcePareto)
	if limit > 0 && len(candidates) > limit {
		return candidates[:limit]
	}

	return candidates
}

func (a *App) GetDecisionScenarios() []DecisionScenario {
	return getDecisionScenarios()
}

func (a *App) GetDecisionCriteria() []DecisionCriterion {
	return getDecisionCriteria()
}

func (a *App) AnalyzeDecision(request DecisionRequest) DecisionAnalysis {
	return a.analyzeDecision(request)
}

func (a *App) ExportDecisionCSV(request DecisionRequest) string {
	content, err := buildDecisionCSV(a.analyzeDecision(request))
	if err != nil {
		return ""
	}

	return content
}

func (a *App) ExportDecisionJSON(request DecisionRequest) string {
	content, err := buildDecisionJSON(a.analyzeDecision(request))
	if err != nil {
		return ""
	}

	return content
}
