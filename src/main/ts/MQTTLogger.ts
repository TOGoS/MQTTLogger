///<reference path="./Promise.d.ts"/>
import * as mqtt from 'mqtt';
import LogWriter from './LogWriter';
import * as events from 'events';
import MQTTURLOption from './MQTTURLOption';

const dateRegex = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d(?::\d\d))$/;

export default class MQTTLogger extends events.EventEmitter {
	protected client : mqtt.Client;
	protected logWriter = new LogWriter();
	public serverUrl:string;
	public topicNames:string[];
	
	public constructor() {
		super();
	}
	
	public start() {
		return new Promise<void>( (resolve,reject) => {
			console.log("# Attempting to connect to "+this.serverUrl+"...")
			this.client = mqtt.connect(this.serverUrl);
			this.client.on('error', reject);
			this.client.on('connect', () => {
				console.log("# Connected to "+this.serverUrl);
				resolve();
			});
			
			for( let t in this.topicNames ) this.client.subscribe(this.topicNames[t]);
			this.client.on('message', (topic:string,data:Buffer) => {
				const text = data.toString();
				const tokens = text.split(/\s+/);
				let explicitTime:Date|undefined = undefined;
				if( tokens.length > 0 ) {
					if( dateRegex.exec(tokens[0]) ) {
						explicitTime = new Date(Date.parse(tokens[0]));
					}
				}
				
				const line = this.logWriter.message({
					text,
					receivedTime: new Date(),
					topic,
					explicitTime,
				});
				this.emit('line', topic, line);
			});
		});
	}
}

if( typeof module != 'undefined' && typeof require != 'undefined' && module == require.main ) {
	let logMessagesToConsole = false; 

	let serverOpt:MQTTURLOption = new MQTTURLOption();
	let topicNames:string[] = [];
	const argv = process.argv;
	for( let i=2; i<argv.length; ++i ) {
		if( argv[i] == '-v' ) {
			logMessagesToConsole = true;
		} else if( argv[i] == '-?' || argv[i] == '--help' ) {
			console.log("Usage: "+argv[1]+" [-v]");
			process.exit(0);
		} else if( argv[i] == '-h' ) {
			serverOpt.setHost(argv[++i]);
		} else if( argv[i] == '-p' ) {
			serverOpt.setPort(argv[++i]);
		} else if( argv[i] == '-t' ) {
			topicNames.push(argv[++i]);
		} else {
			console.error(argv[1]+": Error: Unrecognized argument '"+argv[i]+"'");
			console.error(argv[1]+": Say -? for help");
			process.exit(1);
		}
	}

	const logger = new MQTTLogger();
	logger.serverUrl = serverOpt.getUrl();
	logger.topicNames = topicNames;
	const startPromise = logger.start();
	startPromise.catch( (err) => {
		console.error(err);
		process.exitCode = 1;
	});
	if( logMessagesToConsole ) {
		startPromise.then( () => {
			console.log("# Connected; woo");
		});
		logger.on('line', (topic:string,line:string) => console.log(topic+" "+line) );
	}
};
