///<reference path="./Promise.d.ts"/>
import * as mqtt from 'mqtt';

export default class MQTTLogger {
	protected client : mqtt.Client;
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
