export namespace main {
	
	export class RectZone {
	    id: string;
	    label: string;
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new RectZone(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class PriorityZone {
	    id: string;
	    label: string;
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	    weight: number;
	
	    static createFrom(source: any = {}) {
	        return new PriorityZone(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.weight = source["weight"];
	    }
	}
	export class Config {
	    areaWidth: number;
	    areaHeight: number;
	    population: number;
	    maxBudget: number;
	    priorityZones: PriorityZone[];
	    forbiddenZones: RectZone[];
	    obstacleZones: RectZone[];
	    mandatoryZones: RectZone[];
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.areaWidth = source["areaWidth"];
	        this.areaHeight = source["areaHeight"];
	        this.population = source["population"];
	        this.maxBudget = source["maxBudget"];
	        this.priorityZones = this.convertValues(source["priorityZones"], PriorityZone);
	        this.forbiddenZones = this.convertValues(source["forbiddenZones"], RectZone);
	        this.obstacleZones = this.convertValues(source["obstacleZones"], RectZone);
	        this.mandatoryZones = this.convertValues(source["mandatoryZones"], RectZone);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SolutionMetrics {
	    coverage: number;
	    cost: number;
	    overlap: number;
	    sensorCount: number;
	    robustness: number;
	    worstCaseCoverage: number;
	    averageFailureCoverage: number;
	
	    static createFrom(source: any = {}) {
	        return new SolutionMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.coverage = source["coverage"];
	        this.cost = source["cost"];
	        this.overlap = source["overlap"];
	        this.sensorCount = source["sensorCount"];
	        this.robustness = source["robustness"];
	        this.worstCaseCoverage = source["worstCaseCoverage"];
	        this.averageFailureCoverage = source["averageFailureCoverage"];
	    }
	}
	export class Velocity {
	    VX: number;
	    VY: number;
	
	    static createFrom(source: any = {}) {
	        return new Velocity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.VX = source["VX"];
	        this.VY = source["VY"];
	    }
	}
	export class Sensor {
	    id: number;
	    x: number;
	    y: number;
	    range: number;
	    cost: number;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new Sensor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.range = source["range"];
	        this.cost = source["cost"];
	        this.type = source["type"];
	    }
	}
	export class Individual {
	    sensors: Sensor[];
	    velocity: Velocity[];
	    pBest: Sensor[];
	    bestFit: number;
	    fitness: number;
	    totalCost: number;
	    isPareto: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Individual(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sensors = this.convertValues(source["sensors"], Sensor);
	        this.velocity = this.convertValues(source["velocity"], Velocity);
	        this.pBest = this.convertValues(source["pBest"], Sensor);
	        this.bestFit = source["bestFit"];
	        this.fitness = source["fitness"];
	        this.totalCost = source["totalCost"];
	        this.isPareto = source["isPareto"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RankedSolution {
	    solutionID: string;
	    label: string;
	    individual: Individual;
	    metrics: SolutionMetrics;
	    topsisScore: number;
	    weightedSumScore: number;
	    rank: number;
	    weightedSumRank: number;
	    paretoStatus: boolean;
	    explanation: string;
	
	    static createFrom(source: any = {}) {
	        return new RankedSolution(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.solutionID = source["solutionID"];
	        this.label = source["label"];
	        this.individual = this.convertValues(source["individual"], Individual);
	        this.metrics = this.convertValues(source["metrics"], SolutionMetrics);
	        this.topsisScore = source["topsisScore"];
	        this.weightedSumScore = source["weightedSumScore"];
	        this.rank = source["rank"];
	        this.weightedSumRank = source["weightedSumRank"];
	        this.paretoStatus = source["paretoStatus"];
	        this.explanation = source["explanation"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DecisionWeights {
	    coverage: number;
	    cost: number;
	    overlap: number;
	    sensorCount: number;
	    robustness: number;
	
	    static createFrom(source: any = {}) {
	        return new DecisionWeights(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.coverage = source["coverage"];
	        this.cost = source["cost"];
	        this.overlap = source["overlap"];
	        this.sensorCount = source["sensorCount"];
	        this.robustness = source["robustness"];
	    }
	}
	export class DecisionScenario {
	    id: string;
	    name: string;
	    description: string;
	    weights: DecisionWeights;
	
	    static createFrom(source: any = {}) {
	        return new DecisionScenario(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.weights = this.convertValues(source["weights"], DecisionWeights);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DecisionCriterion {
	    id: string;
	    label: string;
	    goal: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new DecisionCriterion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.goal = source["goal"];
	        this.description = source["description"];
	    }
	}
	export class DecisionAnalysis {
	    criteria: DecisionCriterion[];
	    scenario: DecisionScenario;
	    appliedWeights: DecisionWeights;
	    normalizedWeights: DecisionWeights;
	    primaryMethod: string;
	    baselineMethod: string;
	    candidateSource: string;
	    rankedSolutions: RankedSolution[];
	    recommendedSolutionID: string;
	    weightedSumRecommendedSolutionID: string;
	    recommendedExplanation: string;
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new DecisionAnalysis(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.criteria = this.convertValues(source["criteria"], DecisionCriterion);
	        this.scenario = this.convertValues(source["scenario"], DecisionScenario);
	        this.appliedWeights = this.convertValues(source["appliedWeights"], DecisionWeights);
	        this.normalizedWeights = this.convertValues(source["normalizedWeights"], DecisionWeights);
	        this.primaryMethod = source["primaryMethod"];
	        this.baselineMethod = source["baselineMethod"];
	        this.candidateSource = source["candidateSource"];
	        this.rankedSolutions = this.convertValues(source["rankedSolutions"], RankedSolution);
	        this.recommendedSolutionID = source["recommendedSolutionID"];
	        this.weightedSumRecommendedSolutionID = source["weightedSumRecommendedSolutionID"];
	        this.recommendedExplanation = source["recommendedExplanation"];
	        this.summary = source["summary"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DecisionRequest {
	    scenarioID: string;
	    candidateSource: string;
	    primaryMethod: string;
	    weights: DecisionWeights;
	
	    static createFrom(source: any = {}) {
	        return new DecisionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scenarioID = source["scenarioID"];
	        this.candidateSource = source["candidateSource"];
	        this.primaryMethod = source["primaryMethod"];
	        this.weights = this.convertValues(source["weights"], DecisionWeights);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	
	
	

}

