export namespace main {
	
	export class Config {
	    areaWidth: number;
	    areaHeight: number;
	    population: number;
	    maxBudget: number;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.areaWidth = source["areaWidth"];
	        this.areaHeight = source["areaHeight"];
	        this.population = source["population"];
	        this.maxBudget = source["maxBudget"];
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
	    fitness: number;
	    totalCost: number;
	    isPareto: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Individual(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sensors = this.convertValues(source["sensors"], Sensor);
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

}

