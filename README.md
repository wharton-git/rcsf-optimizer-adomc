# RCSF Optimizer ADOMC

## Description

**RCSF Optimizer ADOMC** est une application desktop cross-platform construite avec **Wails**, **Go**, **React** et **TypeScript**.

Le projet conserve un moteur d'optimisation hybride :

- **Algorithme Génétique (GA)**
- **Optimisation par Essaim Particulaire (PSO)**
- **Front de Pareto**

et l'enrichit avec une vraie couche **ADOMC / ADMC** de post-traitement décisionnel.

L'objectif n'est donc plus seulement de générer des solutions optimales, mais aussi de :

- comparer ces solutions selon plusieurs critères métier,
- classer les alternatives,
- recommander une solution défendable,
- expliquer cette recommandation,
- étudier la sensibilité aux pondérations,
- exporter les résultats pour une soutenance ou un rapport.

## Objectifs du projet

Le projet cherche à répondre à un problème d'aide à la décision pour le placement de capteurs dans une zone rectangulaire, sous contraintes de :

- couverture,
- coût,
- budget maximal,
- redondance inutile,
- robustesse à la panne,
- complexité de déploiement.

Le système fonctionne en deux grandes phases :

1. **Optimisation** : le moteur hybride GA + PSO génère et améliore une population de solutions.
2. **Décision multicritère** : une couche ADOMC classe les solutions Pareto avec **TOPSIS** et une **somme pondérée** de référence.

## Fonctionnalités principales

### Optimisation

- Initialisation aléatoire d'une population de solutions
- Évolution hybride **GA + PSO**
- Calcul de fitness basé sur la couverture et une pénalité de chevauchement
- Gestion d'un **budget maximal**
- Détection des solutions **Pareto optimales**
- Déduplication des solutions quasi identiques pour garder des résultats lisibles

### ADOMC / ADMC

- Construction d'une **matrice de décision multicritère**
- Critères pris en compte :
  - couverture,
  - coût total,
  - chevauchement,
  - nombre de capteurs,
  - robustesse à la panne
- Classement principal avec **TOPSIS**
- Méthode de comparaison secondaire avec **somme pondérée**
- Scénarios prédéfinis :
  - économique
  - équilibré
  - couverture maximale
  - robuste
  - maintenance minimale
- Pondérations manuelles configurables par l'utilisateur
- Recommandation automatique d'une solution
- Génération d'explications textuelles simples et soutenables

### Métier / spatial

- Couverture pondérée par **zones prioritaires**
- Structure prête pour :
  - zones interdites
  - obstacles
  - zones à couverture obligatoire

### Interface

- Dashboard React orienté aide à la décision
- Visualisation du placement des capteurs sur la zone
- Graphique Pareto avec mise en évidence :
  - des points Pareto
  - de la solution sélectionnée
  - de la solution recommandée ADOMC
- Tableau multicritère triable
- Comparaison côte à côte de 2 à 3 solutions
- Analyse de sensibilité sur les poids
- Export CSV et JSON

## Architecture

### Stack technique

- **Desktop shell** : [Wails v2](https://wails.io/)
- **Backend** : [Go](https://golang.org/)
- **Frontend** : [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler frontend** : [Vite](https://vitejs.dev/)
- **Visualisation** : [Recharts](https://recharts.org/)
- **Installer Windows** : [NSIS](https://nsis.sourceforge.io/)

### Structure actuelle du dépôt

```text
rcsf-optimizer-adomc/
├── main.go
├── app.go
├── models.go
├── optimizer.go
├── fitness.go
├── pso.go
├── genetic.go
├── pareto.go
├── scenarios.go
├── mcda.go
├── export.go
├── pareto_test.go
├── fitness_test.go
├── mcda_test.go
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ComparisonPanel.tsx
│   │   │   ├── DecisionControls.tsx
│   │   │   ├── DecisionRankingTable.tsx
│   │   │   ├── ParetoChart.tsx
│   │   │   ├── PriorityZonesPanel.tsx
│   │   │   ├── RecommendationPanel.tsx
│   │   │   └── SensitivityPanel.tsx
│   │   ├── utils/
│   │   │   └── solutions.ts
│   │   └── style.css
│   └── wailsjs/
├── build/
├── wails.json
└── README.md
```

### Rôle des modules backend

- `app.go`
  Orchestration générale Wails, configuration, catalogue, exposition des méthodes backend au frontend.

- `models.go`
  Structures métier : capteurs, individus, configuration, zones, scénarios, critères, résultats de classement.

- `optimizer.go`
  Initialisation de population et boucle principale d'évolution.

- `fitness.go`
  Calcul de couverture, couverture pondérée, pénalité de chevauchement, robustesse à la panne.

- `pso.go`
  Mise à jour des positions par essaim particulaire.

- `genetic.go`
  Sélection, croisement et mutation génétiques.

- `pareto.go`
  Dominance, front de Pareto, tri et filtrage des solutions proches.

- `scenarios.go`
  Définition des scénarios de décision et des constantes ADOMC.

- `mcda.go`
  Construction de la matrice multicritère, TOPSIS, somme pondérée, explications, synthèse de recommandation.

- `export.go`
  Export CSV et JSON des résultats d'analyse.

## Catalogue de capteurs

Le projet inclut actuellement trois types de capteurs prédéfinis :

| Type | Portée (m) | Coût (Ar) |
|------|-----------:|----------:|
| Eco-A | 15 | 45 000 |
| Standard-B | 50 | 180 000 |
| Premium-C | 120 | 650 000 |

Le catalogue est éditable directement dans l'interface.

## Méthodologie d'optimisation

### 1. Moteur hybride conservé

Le moteur existant n'a pas été remplacé.

Le pipeline reste :

1. génération d'une population initiale,
2. calcul de fitness,
3. mise à jour PSO,
4. opérateurs génétiques,
5. filtrage Pareto,
6. répétition des itérations.

### 2. Fitness

La fitness combine :

- la **couverture** de la zone,
- une pénalité liée au **chevauchement excessif**,
- le respect du **budget maximal**.

La couverture est échantillonnée sur une grille régulière, ce qui permet aussi d'intégrer :

- les zones prioritaires,
- les zones interdites,
- les obstacles,
- les zones obligatoires.

## Méthodologie ADOMC implémentée

### Critères décisionnels

Chaque solution candidate est évaluée selon :

1. **Couverture** à maximiser
2. **Coût total** à minimiser
3. **Chevauchement** à minimiser
4. **Nombre de capteurs** à minimiser
5. **Robustesse** à maximiser

### Robustesse

La robustesse est calculée par une simulation simple et démontrable :

- on retire un capteur à la fois,
- on recalcule la couverture restante,
- on retient le **pire cas**,
- le score final reflète la capacité de la solution à conserver sa couverture malgré une panne.

### TOPSIS

La recommandation principale repose sur **TOPSIS** :

1. normalisation de la matrice de décision,
2. pondération des critères,
3. calcul de la solution idéale positive,
4. calcul de la solution idéale négative,
5. mesure de la distance relative à ces idéaux,
6. calcul du score final.

### Baseline de comparaison

Une **somme pondérée normalisée** est calculée en parallèle pour fournir :

- une comparaison méthodologique,
- un second point de vue sur le classement,
- un support d'explication en soutenance.

## Scénarios prédéfinis

Les scénarios fournis sont :

- **Économique**
  Priorise le coût et la simplicité de déploiement.

- **Équilibré**
  Cherche un compromis global entre couverture, coût et robustesse.

- **Couverture maximale**
  Favorise avant tout la couverture de la zone.

- **Robuste**
  Priorise la résistance à la panne d'un capteur.

- **Maintenance minimale**
  Réduit le nombre de capteurs et la redondance inutile.

## Interface utilisateur

Le frontend propose désormais un vrai tableau de bord ADOMC avec :

- réglage des contraintes globales,
- édition du catalogue de capteurs,
- édition des zones prioritaires,
- choix d'un scénario décisionnel,
- ajustement manuel des poids,
- classement multicritère triable,
- recommandation expliquée,
- comparaison de solutions,
- analyse de sensibilité,
- visualisation Pareto enrichie,
- export CSV / JSON.

## Utilisation

### Prérequis

- Go
- Node.js / npm
- Wails CLI

### Installation

Depuis la racine du projet :

```bash
cd frontend
npm install
cd ..
```

### Développement

```bash
wails dev
```

### Build frontend seul

```bash
cd frontend
npm run build
```

### Compilation applicative

#### Linux/macOS

```bash
wails build
```

#### Windows AMD64

```bash
wails build --target windows/amd64 --nsis
```

#### Windows ARM64

```bash
wails build --target windows/arm64 --nsis
```

## Tests et validation

### Tests backend

```bash
go test ./...
```

Les tests ajoutés couvrent notamment :

- la dominance Pareto,
- le calcul de chevauchement,
- le score de robustesse,
- le classement multicritère sur cas simples.

### Vérification TypeScript

```bash
cd frontend
./node_modules/.bin/tsc --noEmit
```

### Build frontend

```bash
cd frontend
./node_modules/.bin/vite build
```

## Exports

Le projet permet actuellement :

- **export CSV** des solutions classées,
- **export JSON** détaillé de l'analyse multicritère.

Le contenu exporté inclut notamment :

- la hiérarchie des solutions,
- les métriques métier,
- les scores TOPSIS,
- les scores de somme pondérée,
- les explications synthétiques,
- la solution recommandée.

## État méthodologique du projet

Le projet est désormais :

- un **optimiseur hybride GA + PSO**,
- avec **front de Pareto**,
- enrichi par une **couche ADOMC explicite**,
- plus **maintenable** grâce à une architecture modulaire,
- plus **défendable académiquement** grâce à la séparation optimisation / décision,
- plus **présentable** visuellement pour une démonstration.

## Perspectives

L'architecture actuelle permet d'ajouter plus facilement à l'avenir :

- **PROMETHEE**
- **ELECTRE**
- davantage de scénarios métier
- gestion complète des obstacles
- vraies zones interdites dans l'interface
- génération d'un rapport synthétique automatisé

## Distribution

### Windows

Les scripts d'installation Windows se trouvent dans :

- [build/windows/installer/project.nsi](build/windows/installer/project.nsi)
- [build/windows/installer/wails_tools.nsh](build/windows/installer/wails_tools.nsh)

## Auteur

- **Nom** : Xeon@Sanctuary
- **Email** : whartonaldrick@gmail.com

## Licence

À définir

## Ressources utiles

- [Documentation Wails](https://wails.io/)
- [Documentation Go](https://golang.org/doc/)
- [Documentation React](https://react.dev/)
- [Documentation TypeScript](https://www.typescriptlang.org/)
- [Documentation Recharts](https://recharts.org/)
