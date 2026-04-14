package main

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"
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
	VX float64
	VY float64
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

type Config struct {
	AreaWidth  float64 `json:"areaWidth"`
	AreaHeight float64 `json:"areaHeight"`
	Population int     `json:"population"`
	MaxBudget  float64 `json:"maxBudget"`
}

type App struct {
	ctx    context.Context
	config Config
	points []Individual
}

var SensorCatalog = []Sensor{
	{Type: "Eco-A", Range: 15, Cost: 45000},
	{Type: "Standard-B", Range: 50, Cost: 180000},
	{Type: "Premium-C", Range: 120, Cost: 650000},
}

func NewApp() *App {
	return &App{
		config: Config{
			AreaWidth:  80,
			AreaHeight: 60,
			Population: 50,
			MaxBudget:  2000000,
		},
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) InitPopulation() {
	rand.Seed(time.Now().UnixNano())
	a.points = make([]Individual, a.config.Population)

	for i := 0; i < a.config.Population; i++ {

		numSensors := rand.Intn(10) + 1

		sensors := make([]Sensor, numSensors)
		velocities := make([]Velocity, numSensors)

		for j := 0; j < numSensors; j++ {
			t := SensorCatalog[rand.Intn(len(SensorCatalog))]

			// Tenter un placement non-superposé (max 10 essais)
			var x, y float64
			for attempt := 0; attempt < 10; attempt++ {
				x = rand.Float64() * a.config.AreaWidth
				y = rand.Float64() * a.config.AreaHeight
				tooClose := false
				for k := 0; k < j; k++ {
					dx := x - sensors[k].X
					dy := y - sensors[k].Y
					if math.Sqrt(dx*dx+dy*dy) < (t.Range+sensors[k].Range)*0.5 {
						tooClose = true
						break
					}
				}
				if !tooClose {
					break
				}
			}

			sensors[j] = Sensor{
				ID: j, X: x, Y: y,
				Range: t.Range, Cost: t.Cost, Type: t.Type,
			}

			velocities[j] = Velocity{
				VX: rand.Float64()*2 - 1,
				VY: rand.Float64()*2 - 1,
			}
		}

		ind := Individual{
			Sensors:  sensors,
			Velocity: velocities,
			PBest:    append([]Sensor{}, sensors...),
		}

		a.CalculateFitness(&ind)
		ind.BestFit = ind.Fitness
		a.points[i] = ind
	}

	a.UpdateParetoFront()
}

func (a *App) getBestFitnessIndividual() Individual {
	if len(a.points) == 0 {
		return Individual{}
	}

	var best Individual
	found := false

	for _, ind := range a.points {
		if ind.Fitness <= 0 {
			continue
		}

		if !found || ind.Fitness > best.Fitness {
			best = ind
			found = true
		}
	}

	if !found {
		return a.points[0]
	}

	return best
}

func (a *App) Evolve() []Individual {
	if len(a.points) == 0 {
		a.InitPopulation()
		return a.points
	}

	gBest := a.getBestFitnessIndividual()

	for i := range a.points {
		a.UpdatePositions(&a.points[i], gBest.Sensors)
		a.CalculateFitness(&a.points[i])

		if a.points[i].Fitness > a.points[i].BestFit {
			a.points[i].BestFit = a.points[i].Fitness
			a.points[i].PBest = append([]Sensor{}, a.points[i].Sensors...)
		}
	}

	a.applyGeneticOperators()
	a.UpdateParetoFront()

	return a.points
}

func (a *App) UpdatePositions(ind *Individual, gBest []Sensor) {
	w := 0.7
	c1 := 1.5
	c2 := 1.5
	repulsionStrength := 5.0

	for i := range ind.Sensors {
		if i >= len(gBest) || i >= len(ind.PBest) {
			break
		}

		r1 := rand.Float64()
		r2 := rand.Float64()

		// Force de répulsion entre capteurs du même individu
		repX, repY := 0.0, 0.0
		for j := range ind.Sensors {
			if i == j {
				continue
			}
			dx := ind.Sensors[i].X - ind.Sensors[j].X
			dy := ind.Sensors[i].Y - ind.Sensors[j].Y
			d := math.Sqrt(dx*dx+dy*dy) + 0.001
			minDist := (ind.Sensors[i].Range + ind.Sensors[j].Range) * 0.5

			if d < minDist {
				repX += (dx / d) * (minDist - d) * repulsionStrength
				repY += (dy / d) * (minDist - d) * repulsionStrength
			}
		}

		ind.Velocity[i].VX =
			w*ind.Velocity[i].VX +
				c1*r1*(ind.PBest[i].X-ind.Sensors[i].X) +
				c2*r2*(gBest[i].X-ind.Sensors[i].X) +
				repX

		ind.Velocity[i].VY =
			w*ind.Velocity[i].VY +
				c1*r1*(ind.PBest[i].Y-ind.Sensors[i].Y) +
				c2*r2*(gBest[i].Y-ind.Sensors[i].Y) +
				repY

		ind.Sensors[i].X = math.Max(0, math.Min(a.config.AreaWidth, ind.Sensors[i].X+ind.Velocity[i].VX))
		ind.Sensors[i].Y = math.Max(0, math.Min(a.config.AreaHeight, ind.Sensors[i].Y+ind.Velocity[i].VY))
	}
}

func (a *App) CalculateFitness(ind *Individual) {
	ind.TotalCost = 0
	for _, s := range ind.Sensors {
		ind.TotalCost += s.Cost
	}

	if ind.TotalCost > a.config.MaxBudget {
		ind.Fitness = 0
		return
	}

	coverage := a.computeCoverage(ind.Sensors)

	// Pénalité pour superposition
	overlapPenalty := 0.0
	for i := 0; i < len(ind.Sensors); i++ {
		for j := i + 1; j < len(ind.Sensors); j++ {
			si, sj := ind.Sensors[i], ind.Sensors[j]
			dx := si.X - sj.X
			dy := si.Y - sj.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			minDist := (si.Range + sj.Range) * 0.5 // seuil : 50% de chevauchement

			if dist < minDist {
				overlapPenalty += (minDist - dist) / minDist
			}
		}
	}

	penaltyFactor := 1.0 / (1.0 + overlapPenalty*0.3)
	ind.Fitness = coverage * penaltyFactor
}

func (a *App) computeCoverage(sensors []Sensor) float64 {
	step := 2.0
	covered := 0
	total := 0

	for x := 0.0; x < a.config.AreaWidth; x += step {
		for y := 0.0; y < a.config.AreaHeight; y += step {
			total++

			for _, s := range sensors {
				dx := x - s.X
				dy := y - s.Y
				if dx*dx+dy*dy <= s.Range*s.Range {
					covered++
					break
				}
			}
		}
	}

	if total == 0 {
		return 0
	}

	return float64(covered) / float64(total) * 100
}

/* ===========================
   PSO + GA HYBRID
=========================== */

func (a *App) applyGeneticOperators() {
	sort.Slice(a.points, func(i, j int) bool {
		return a.points[i].Fitness > a.points[j].Fitness
	})

	eliteSize := int(0.2 * float64(len(a.points)))
	if eliteSize < 1 {
		eliteSize = 1
	}

	newPop := append([]Individual{}, a.points[:eliteSize]...)

	for len(newPop) < len(a.points) {
		p1 := a.tournamentSelect()
		p2 := a.tournamentSelect()

		child := crossover(p1, p2)
		mutate(&child)

		child.Velocity = make([]Velocity, len(child.Sensors))
		for i := range child.Velocity {
			child.Velocity[i] = Velocity{
				VX: rand.Float64()*2 - 1,
				VY: rand.Float64()*2 - 1,
			}
		}

		child.PBest = append([]Sensor{}, child.Sensors...)
		a.CalculateFitness(&child)
		child.BestFit = child.Fitness

		newPop = append(newPop, child)
	}

	a.points = newPop
}

func (a *App) tournamentSelect() Individual {
	best := a.points[rand.Intn(len(a.points))]

	for i := 0; i < 3; i++ {
		c := a.points[rand.Intn(len(a.points))]
		if c.Fitness > best.Fitness {
			best = c
		}
	}

	return best
}

func crossover(p1, p2 Individual) Individual {
	child := Individual{}

	n := max(len(p1.Sensors), len(p2.Sensors))

	for i := 0; i < n; i++ {
		if rand.Float64() < 0.5 && i < len(p1.Sensors) {
			child.Sensors = append(child.Sensors, p1.Sensors[i])
		} else if i < len(p2.Sensors) {
			child.Sensors = append(child.Sensors, p2.Sensors[i])
		}
	}

	return child
}

func mutate(ind *Individual) {
	for i := range ind.Sensors {
		if rand.Float64() < 0.2 {
			ind.Sensors[i].X += rand.Float64()*20 - 10
			ind.Sensors[i].Y += rand.Float64()*20 - 10
		}

		if rand.Float64() < 0.1 {
			t := SensorCatalog[rand.Intn(len(SensorCatalog))]
			ind.Sensors[i].Type = t.Type
			ind.Sensors[i].Range = t.Range
			ind.Sensors[i].Cost = t.Cost
		}
	}
}

/* ===========================
   PARETO + DEDUP
=========================== */

func (a *App) UpdateParetoFront() {
	for i := range a.points {
		a.points[i].IsPareto = true
	}

	for i := range a.points {
		if a.points[i].Fitness == 0 {
			a.points[i].IsPareto = false
			continue
		}

		for j := range a.points {
			if i == j {
				continue
			}
			if a.points[j].Fitness == 0 {
				continue
			}

			if dominates(a.points[j], a.points[i]) {
				a.points[i].IsPareto = false
				break
			}
		}
	}

	seen := map[string]bool{}

	for i := range a.points {
		if !a.points[i].IsPareto {
			continue
		}

		sig := getSignature(a.points[i])
		if seen[sig] {
			a.points[i].IsPareto = false
		} else {
			seen[sig] = true
		}
	}
}

func dominates(a1, a2 Individual) bool {
	return (a1.Fitness >= a2.Fitness && a1.TotalCost <= a2.TotalCost) &&
		(a1.Fitness > a2.Fitness || a1.TotalCost < a2.TotalCost)
}

func getSignature(ind Individual) string {
	counts := map[string]int{}

	for _, s := range ind.Sensors {
		counts[s.Type]++
	}

	sig := ""

	for k, v := range counts {
		sig += fmt.Sprintf("%s:%d|", k, v)
	}

	sig += fmt.Sprintf("C%.0f-F%.1f", ind.TotalCost, ind.Fitness)

	return sig
}

/* ===========================
   OPTIMAL DIVERSIFIED (NEW)
=========================== */

// Dans app.go
func (a *App) GetOptimalSolutions(limit int) []Individual {
	pareto := []Individual{}
	for _, ind := range a.points {
		if ind.IsPareto && ind.Fitness > 0 {
			pareto = append(pareto, ind)
		}
	}

	// Trier par efficacité (Fitness / Coût)
	sort.Slice(pareto, func(i, j int) bool {
		return (pareto[i].Fitness / (pareto[i].TotalCost + 1)) >
			(pareto[j].Fitness / (pareto[j].TotalCost + 1))
	})

	selected := []Individual{}
	for _, cand := range pareto {
		isSimilar := false
		for _, s := range selected {
			// Filtrer si le coût est trop proche (ex: moins de 50 000 Ar d'écart)
			// ET que la couverture est très proche
			costDiff := math.Abs(cand.TotalCost - s.TotalCost)
			fitDiff := math.Abs(cand.Fitness - s.Fitness)

			if costDiff < 50000 && fitDiff < 0.5 {
				isSimilar = true
				break
			}
		}

		if !isSimilar {
			selected = append(selected, cand)
		}
		if len(selected) >= limit {
			break
		}
	}
	return selected
}

func dist(a, b Individual) float64 {
	if len(a.Sensors) == 0 || len(b.Sensors) == 0 {
		return 999999
	}

	dx := a.Sensors[0].X - b.Sensors[0].X
	dy := a.Sensors[0].Y - b.Sensors[0].Y

	return math.Sqrt(dx*dx + dy*dy)
}

func (a *App) SetConstraints(config Config) {
	a.config = config
	a.InitPopulation()
}

func (a *App) UpdateCatalog(newCatalog []Sensor) {
	SensorCatalog = newCatalog
	a.InitPopulation()
}

func (a *App) GetCatalog() []Sensor {
	return SensorCatalog
}

func (a *App) GetAllSolutions() []Individual {
	return a.points
}

func (a *App) computeScore(ind Individual) float64 {
	if ind.TotalCost <= 0 {
		return 0
	}

	return ind.Fitness / (ind.TotalCost + 1)
}
