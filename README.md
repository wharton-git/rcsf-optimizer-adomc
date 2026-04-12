# RCSF Optimizer

## Description

**RCSF Optimizer** est une application de bureau cross-platform conçue pour optimiser le placement de capteurs dans un réseau de couverture. Utilisant des algorithmes génétiques et des techniques d'essaim particulaire, l'application trouve des solutions optimales pour maximiser la couverture de zone tout en respectant des contraintes de budget.

## Caractéristiques

- 🎯 **Optimisation multi-objectif** : Maximise la couverture tout en minimisant le coût
- 📊 **Visualisation Pareto** : Représentation graphique du front de Pareto des solutions
- 🎨 **Interface intuitive** : Interface React moderne avec visualisation en temps réel
- 💰 **Gestion de budget** : Définissez un budget maximum pour votre réseau de capteurs
- 🔄 **Algorithme évolutionnaire** : Combine algorithmes génétiques et optimisation par essaim particulaire
- 📐 **Paramètres configurables** : Ajustez les dimensions de la zone, la population et le budget

## Architecture

### Structure du projet

```
rcsf-optimizer/
├── frontend/                 # Application React + TypeScript
│   ├── src/
│   │   ├── App.tsx          # Composant principal
│   │   ├── components/      # Composants réutilisables
│   │   │   └── ParetoChart.tsx  # Graphique Pareto
│   │   ├── assets/          # Images et polices
│   │   └── style.css        # Styles globaux
│   ├── vite.config.ts       # Configuration Vite
│   └── package.json         # Dépendances npm
├── app.go                   # Logique backend Go
├── main.go                  # Point d'entrée de l'application
├── build/                   # Configuration de compilation
│   ├── windows/             # Fichiers spécifiques Windows
│   │   └── installer/       # Scripts NSIS pour l'installeur
│   └── darwin/              # Fichiers spécifiques macOS
├── wails.json               # Configuration Wails
└── README.md                # Ce fichier
```

### Stack technologique

- **Backend** : [Go](https://golang.org/) + [Wails v2](https://wails.io/)
- **Frontend** : [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool** : [Vite](https://vitejs.dev/)
- **Graphiques** : [Recharts](https://recharts.org/)
- **Installeur** : [NSIS](https://nsis.sourceforge.io/) (Windows)

## Catalogue de capteurs

L'application inclut trois types de capteurs prédéfinis :

| Type | Portée (m) | Coût (Ar) |
|------|-----------|-----------|
| Eco-A | 15 | 45 000 |
| Standard-B | 50 | 180 000 |
| Premium-C | 120 | 650 000 |

## Utilisation

### Démarrage en développement

```bash
# Installation des dépendances
npm install

# Lancer le serveur de développement
wails dev
```

### Compilation

#### Linux/macOS
```bash
wails build
```

#### Windows (AMD64)
```bash
wails build --target windows/amd64 --nsis
```

#### Windows (ARM64)
```bash
wails build --target windows/arm64 --nsis
```

#### Windows (Multi-arch)
```bash
wails build --target windows/amd64 --target windows/arm64 --nsis
```

## Paramètres configurables

- **Largeur de zone** : Largeur de la zone à couvrir (en mètres)
- **Hauteur de zone** : Hauteur de la zone à couvrir (en mètres)
- **Population** : Nombre d'individus par génération
- **Budget maximum** : Budgt alloué pour l'achat des capteurs (en Ariary)

## Algorithme d'optimisation

### Flux de travail

1. **Initialisation** : Génération d'une population aléatoire de solutions
2. **Évaluation** : Calcul de la fitness (couverture) pour chaque solution
3. **Évolution** : Application des opérateurs génétiques (croisement, mutation)
4. **Mise à jour Pareto** : Identification des solutions non-dominées
5. **Répétition** : Les étapes 2-4 se répètent jusqu'à convergence

### Calcul de la couverture

La couverture est déterminée par la zone totale couverte par tous les capteurs, en tenant compte de leur portée de détection circulaire.

## Visualisation

### Graphique de couverture
- Affichage en temps réel du placement des capteurs
- Code couleur par type de capteur
- Grille dynamique adaptée à la taille de la zone

### Front de Pareto
- Visualisation scatter du compromis coût/couverture
- Mise en évidence des solutions optimales
- Formattage des coûts pour lisibilité

## Développement

### Structure des fichiers

#### Backend ([app.go](app.go))
- `Config` : Configuration de l'optimisation
- `Sensor` : Structure d'un capteur
- `Individual` : Solution candidate
- Méthodes principales :
  - `InitPopulation()` : Initialisation
  - `Evolve()` : Évolution d'une génération
  - `CalculateFitness()` : Évaluation
  - `UpdateParetoFront()` : Mise à jour Pareto

#### Frontend
- [App.tsx](frontend/src/App.tsx) : Gestion d'état et logique métier
- [ParetoChart.tsx](frontend/src/components/ParetoChart.tsx) : Visualisation Pareto
- [wailsjs/go/models](frontend/wailsjs/go/models) : Types générés automatiquement

## Distribution

### Windows

L'installeur NSIS support les architectures AMD64 et ARM64. Les fichiers d'installation se trouvent dans :
- [build/windows/installer/project.nsi](build/windows/installer/project.nsi) - Script principal
- [build/windows/installer/wails_tools.nsh](build/windows/installer/wails_tools.nsh) - Macros utilitaires

## Auteur

- **Nom** : Xeon@Sanctuary
- **Email** : whartonaldrick@gmail.com

## License

À définir

## Ressources utiles

- [Documentation Wails](https://wails.io/)
- [Documentation Go](https://golang.org/doc/)
- [Documentation React](https://react.dev/)
- [Documentation Recharts](https://recharts.org/)