///<reference path="./Promise.d.ts"/>
import * as mqtt from 'mqtt';
import LogWriter from './LogWriter';

const dateRegex = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d(?::\d\d))$/;

export default class MQTTLogger {
	protected client : mqtt.Client;
	protected logWriter = new LogWriter();
	public start() {
		return new Promise<void>( (resolve,reject) => {
			const serverUrl = "mqtt://togos-pi6.nuke24.net";
			console.log("Attempting to connect to "+serverUrl+"...")
			this.client = mqtt.connect(serverUrl);
			this.client.on('connect', () => {
				resolve();
			});

			this.client.subscribe('device-chat');
			this.client.on('message', (topic:string,data:Buffer) => {
				const text = data.toString();
				const tokens = text.split(/\s+/);
				let explicitTime:Date|undefined = undefined;
				if( tokens.length > 0 ) {
					if( dateRegex.exec(tokens[0]) ) {
						explicitTime = new Date(Date.parse(tokens[0]));
					}
				}
				
				this.logWriter.message({
					text,
					receivedTime: new Date(),
					topic,
					explicitTime,
				})
				console.log("Got message on "+topic+": "+data.toString());
			});
			this.client.on('error', reject);
			console.log("...");
		});
	}
}

new MQTTLogger().start().then( () => {
	console.log("Connected!");
}, (err) => {
	console.error(err);
	process.exitCode = 1;
})
