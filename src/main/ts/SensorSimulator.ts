import * as mqtt from 'mqtt';
import { clearInterval, clearTimeout } from "timers";

// Off the grid and need to simulate some sensors?
// I am here for you!!
// MQTT server not included.
// But mosquitto is pretty easy to install everywhere I've needed it.

interface FakeSensorConfig {
	topic : string;
	minValue : number;
	maxValue : number;
	maxDelta : number;
	minReportDelta? : number;
	maxReportInterval? : number;
}

class FakeSensor {
	public topic : string;
	minValue : number;
	maxValue : number;
	value : number;
	maxDelta : number;
	public lastReportTime : number|undefined = undefined;
	public lastReportedValue : number|undefined = undefined;
	public minReportDelta : number;
	public maxReportInterval : number;
	public constructor(config:FakeSensorConfig) {
		this.topic = config.topic;
		this.minValue = config.minValue;
		this.maxValue = config.maxValue;
		this.maxDelta = config.maxDelta;
		this.minReportDelta = config.minReportDelta || 1;
		this.maxReportInterval = config.maxReportInterval || 60;
		this.reset();
	}

	public reset() : void {
		this.value = this.minValue + Math.random() * (this.maxValue - this.minValue);
	}

	public step() : void {
		let randOffset:number;
		if( this.value > this.maxValue ) randOffset = -1;
		if( this.value < this.minValue ) randOffset =  0;
		else randOffset = -0.5;
		this.value += (Math.random() + randOffset) * 2 * this.maxDelta;
	}

	public get(time:number) : number {
		this.step();
		return this.value;
	}
}

interface SensorSimConfig {
	sensors : FakeSensorConfig[];
	readInterval : number;
}

class SensorSimulator {
	protected sensors:FakeSensor[] = [];
	protected readInterval:number;
	protected timerId:number|undefined;

	public constructor(config:SensorSimConfig, protected mqttClient:mqtt.Client) {
		this.readInterval = config.readInterval || 10;
		for( let s in config.sensors ) {
			this.sensors.push(new FakeSensor(config.sensors[s]));
		}
	}

	protected doRead():void {
		for( let s in this.sensors ) {
			const sensor = this.sensors[s];
			const time = new Date().getTime()/1000;
			const val = sensor.get(time);
			if(
				sensor.lastReportedValue == undefined ||
				Math.abs(val - sensor.lastReportedValue) >= sensor.minReportDelta ||
				sensor.lastReportTime == undefined ||
				time - sensor.lastReportTime > sensor.maxReportInterval
			) {
				this.mqttClient.publish(sensor.topic, val.toString());
				sensor.lastReportedValue = val;
				sensor.lastReportTime = time;
			}
		}
	}

	public start():void {
		if( this.timerId != undefined ) throw new Error("SensorSimulator already running; timerId = "+this.timerId);
		this.timerId = setInterval(this.doRead.bind(this), this.readInterval*1000);
	}
	public stop():void {
		if( this.timerId ) clearInterval(<any>this.timerId);
		this.timerId = undefined;
	}
}

if( typeof module != 'undefined' && typeof require != 'undefined' && module == require.main ) {
	let config:SensorSimConfig = {
		readInterval: 2,
		sensors: [
		]
	};
	let mqttHost : string = "";
	for( let i=2; i<process.argv.length; ++i ) {
		const arg = process.argv[i];
		if( arg == '-h' ) {
			mqttHost = ""+process.argv[++i];
		} else {
			console.error(process.argv[1]+": Error: Unrecognized argument: "+arg);
			process.exit(1);
		}
	}
	if( mqttHost == "" ) {
		console.error(process.argv[1]+": Error: No MQTT host (-h <host>) specified");
		process.exit(1);
	}
	const mqttClient = mqtt.connect(mqttHost);
	mqttClient.on('connect', () => {
		console.error("# Connected to "+mqttHost);
	});
	mqttClient.on('error', (error) => {
		console.error("# MQTT client error: "+error.stack);
	});
	if( config.sensors.length == 0 ) {
		// Make some default fake sensors
		let nodeId = 'AA:BB:CC:DD:EE:FF';
		let devNames = ['dht1','dht2'];
		let props:{[k:string]: {minValue:number; maxValue:number}} = {
			'temperature': {
				minValue: -100,
				maxValue: 200,
			},
			'humidity': {
				minValue: 0,
				maxValue: 100,				
			}
		};
		for( let d in devNames ) {
			for( let p in props ) {
				config.sensors.push({
					topic: nodeId+'/'+devNames[d]+'/'+p,
					minValue: props[p].minValue,
					maxValue: props[p].maxValue,
					maxDelta: 0.25,
					minReportDelta: 0.5,
				})
			}
		}
	}
	new SensorSimulator(config, mqttClient).start();
}
