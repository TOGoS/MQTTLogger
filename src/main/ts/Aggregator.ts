type AggregationResult = {[k:string]: number};

type AggregationResultCallback = (res:AggregationResult)=>any;

/**
 * Periodically reports average values for a set of channels.
 * Transport independent -- needs to be fed values explicitly.
 * Can run automatically on a timer (start())
 * Or explicitly step()'d
 */
class Aggregator {
	// TODO: Could just mind how long the last value's been sitting
	// there every time setValue is called
	// and continuously update averages that way
	// rather than making lists and averaging at report time.
	protected currentValues : {[k:string]: number};
	protected valueLists : {[k:string]: (number|undefined)[]};

	public constructor(
		protected watchKeys:string[],
		protected stepInterval:number,
		protected stepsPerReport:number,
		protected callback:AggregationResultCallback
	) {
	}

	public setValue(key:string, value:number) {
		this.currentValues[key] = value;
	}

	public snapshot():void {
		for( let k in this.watchKeys ) {
			const key = this.watchKeys[k];
			this.valueLists[key].push(this.currentValues[key]);
		}
	}

	public report() : AggregationResult {
		const averages : AggregationResult = {};
		for( let k in this.watchKeys ) {
			const key = this.watchKeys[k];
			let total = 0;
			let count = 0;
			const list = this.valueLists[key];
			for( let i in list ) {
				const v = list[i];
				if( v != undefined ) {
					total += v;
					++count;
				}
			}
			if( count > 0 ) averages[this.watchKeys[k]] = total/count;
		}
		return averages;
	}

	protected stepNumber = 0;
	public step():void {
		this.snapshot();
		if( ((++this.stepNumber) % this.stepsPerReport) == 0 ) {
			this.callback(this.report());
			this.currentValues = {};
		}
	}

	protected intervalId:number|undefined;
	public start():void {
		if( this.intervalId != undefined ) throw new Error("Aggregator already started; intervalId = "+this.intervalId);
		this.intervalId = setInterval(this.step.bind(this), this.stepInterval);
	}

	public stop():void {
		if( this.intervalId == undefined ) return;
		clearInterval(<any>this.intervalId);
		this.intervalId = undefined;
	}
}
