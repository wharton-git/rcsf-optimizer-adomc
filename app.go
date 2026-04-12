package main

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"time"
)

const PixelsPerMeter = 10.0

type Sensor struct {
	ID    int     `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Range float64 `json:"range"`
	Cost  float64 `json:"cost"`
	Type  string  `json:"type"`
}

type Individual struct {
	Sensors   []Sensor `json:"sensors"`
	Fitness   float64  `json:"fitness"`
	TotalCost float64  `json:"totalCost"`
	IsPareto  bool     `json:"isPareto"`
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
		// CHANGEMENT : On autorise de commencer avec très peu de capteurs (1 à 20)
		// Cela permet de rester sous les petits budgets dès le départ
		numSensors := rand.Intn(20) + 1
		sensors := make([]Sensor, numSensors)

		for j := 0; j < numSensors; j++ {
			template := SensorCatalog[rand.Intn(len(SensorCatalog))]
			sensors[j] = Sensor{
				ID:    j,
				X:     rand.Float64() * a.config.AreaWidth,
				Y:     rand.Float64() * a.config.AreaHeight,
				Range: template.Range,
				Cost:  template.Cost,
				Type:  template.Type,
			}
		}

		ind := Individual{Sensors: sensors}
		a.CalculateFitness(&ind)
		a.points[i] = ind
	}
	a.UpdateParetoFront()
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
	}

	a.applyGeneticOperators()
	a.UpdateParetoFront()

	return a.points
}

func (a *App) CalculateFitness(ind *Individual) {
	ind.TotalCost = 0
	for _, s := range ind.Sensors {
		ind.TotalCost += s.Cost
	}

	// CORRECTION : Validation stricte du budget

	// LOG : Facultatif, décommente seulement si tu veux voir les rejets (attention ça peut flooder)
	fmt.Printf("Individu rejeté : Coût %.0f > Budget %.0f\n", ind.TotalCost, a.config.MaxBudget)

	if a.config.MaxBudget > 0 && ind.TotalCost > a.config.MaxBudget {
		ind.Fitness = 0
	} else {
		ind.Fitness = a.computeCoverage(ind.Sensors)
	}
}

func (a *App) computeCoverage(sensors []Sensor) float64 {
	area := a.config.AreaWidth * a.config.AreaHeight
	step := 1.5
	if area > 10000 {
		step = math.Sqrt(area / 5000)
	}

	coveredPoints := 0
	totalPoints := 0

	for x := 0.0; x < a.config.AreaWidth; x += step {
		for y := 0.0; y < a.config.AreaHeight; y += step {
			totalPoints++
			for _, s := range sensors {
				dx := x - s.X
				dy := y - s.Y
				if (dx*dx + dy*dy) <= (s.Range * s.Range) {
					coveredPoints++
					break
				}
			}
		}
	}
	if totalPoints == 0 {
		return 0
	}
	return (float64(coveredPoints) / float64(totalPoints)) * 100
}

func (a *App) UpdatePositions(ind *Individual, gBestSensors []Sensor) {
	w := 0.4
	c2 := 1.2
	for i := range ind.Sensors {
		if i >= len(gBestSensors) {
			break
		}
		shiftX := c2 * (gBestSensors[i].X - ind.Sensors[i].X)
		shiftY := c2 * (gBestSensors[i].Y - ind.Sensors[i].Y)
		ind.Sensors[i].X += shiftX * w
		ind.Sensors[i].Y += shiftY * w
		ind.Sensors[i].X = math.Max(0, math.Min(a.config.AreaWidth, ind.Sensors[i].X))
		ind.Sensors[i].Y = math.Max(0, math.Min(a.config.AreaHeight, ind.Sensors[i].Y))
	}
}

func (a *App) applyGeneticOperators() {
	for i := range a.points {
		// On n'améliore que les individus qui ne sont pas sur le front de Pareto
		if !a.points[i].IsPareto && rand.Float64() < 0.3 {
			r := rand.Float64()

			// AJOUT DE CAPTEUR : Approche par Grille de Chaleur
			if r < 0.30 && len(a.points[i].Sensors) < 200 {
				uncovered := a.findUncoveredPoints(&a.points[i])

				var newX, newY float64
				if len(uncovered) > 0 {
					// On choisit un point au hasard PARMI les zones vides
					target := uncovered[rand.Intn(len(uncovered))]
					newX, newY = target[0], target[1]
				} else {
					// Si tout est déjà couvert, placement aléatoire classique
					newX = rand.Float64() * a.config.AreaWidth
					newY = rand.Float64() * a.config.AreaHeight
				}

				template := SensorCatalog[rand.Intn(len(SensorCatalog))]
				newSensor := Sensor{
					ID:    len(a.points[i].Sensors),
					X:     newX,
					Y:     newY,
					Range: template.Range,
					Cost:  template.Cost,
					Type:  template.Type,
				}
				a.points[i].Sensors = append(a.points[i].Sensors, newSensor)
			} else if r < 0.40 && len(a.points[i].Sensors) > 1 {
				// SUPPRESSION : On garde la logique aléatoire
				idx := rand.Intn(len(a.points[i].Sensors))
				a.points[i].Sensors = append(a.points[i].Sensors[:idx], a.points[i].Sensors[idx+1:]...)
			} else if len(a.points[i].Sensors) > 0 {
				// MUTATION : On garde la logique de changement de type
				idx := rand.Intn(len(a.points[i].Sensors))
				template := SensorCatalog[rand.Intn(len(SensorCatalog))]
				a.points[i].Sensors[idx].Range = template.Range
				a.points[i].Sensors[idx].Cost = template.Cost
				a.points[i].Sensors[idx].Type = template.Type
			}
			a.CalculateFitness(&a.points[i])
		}
	}
}

func (a *App) UpdateParetoFront() {
	for i := range a.points {
		a.points[i].IsPareto = true
	}
	for i := 0; i < len(a.points); i++ {
		if a.points[i].Fitness == 0 {
			a.points[i].IsPareto = false
			continue
		}
		for j := 0; j < len(a.points); j++ {
			if i == j || a.points[j].Fitness == 0 {
				continue
			}
			if a.dominates(a.points[j], a.points[i]) {
				a.points[i].IsPareto = false
				break
			}
		}
	}
}

func (a *App) dominates(indA, indB Individual) bool {
	return (indA.Fitness >= indB.Fitness && indA.TotalCost <= indB.TotalCost) &&
		(indA.Fitness > indB.Fitness || indA.TotalCost < indB.TotalCost)
}

func (a *App) getBestFitnessIndividual() Individual {
	best := a.points[0]
	for _, ind := range a.points {
		if ind.Fitness > best.Fitness {
			best = ind
		}
	}
	return best
}

func (a *App) SetConstraints(config Config) {
	// Mise à jour de la config et RAZ de la population

	fmt.Printf("\n--- RECEPTION NOUVELLES CONTRAINTES ---\n")
	fmt.Printf("Largeur: %v, Hauteur: %v, Budget Max: %v Ar\n", config.AreaWidth, config.AreaHeight, config.MaxBudget)
	fmt.Printf("---------------------------------------\n")

	a.config = config
	a.points = nil
	a.InitPopulation()
}

func (a *App) UpdateCatalog(newCatalog []Sensor) {
	SensorCatalog = newCatalog
	for i := range a.points {
		for j := range a.points[i].Sensors {
			for _, cat := range SensorCatalog {
				if a.points[i].Sensors[j].Type == cat.Type {
					a.points[i].Sensors[j].Cost = cat.Cost
					a.points[i].Sensors[j].Range = cat.Range
				}
			}
		}
		a.CalculateFitness(&a.points[i])
	}
	a.UpdateParetoFront()
}

func (a *App) GetCatalog() []Sensor {
	return SensorCatalog
}

// findUncoveredPoints retourne une liste de coordonnées (x, y) non couvertes
func (a *App) findUncoveredPoints(ind *Individual) [][2]float64 {
	uncovered := [][2]float64{}
	// On utilise un pas légèrement plus large pour la performance
	step := 5.0

	for x := 0.0; x < a.config.AreaWidth; x += step {
		for y := 0.0; y < a.config.AreaHeight; y += step {
			isCovered := false
			for _, s := range ind.Sensors {
				dx := x - s.X
				dy := y - s.Y
				if (dx*dx + dy*dy) <= (s.Range * s.Range) {
					isCovered = true
					break
				}
			}
			if !isCovered {
				uncovered = append(uncovered, [2]float64{x, y})
			}
		}
	}
	return uncovered
}
