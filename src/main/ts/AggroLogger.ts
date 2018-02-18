import * as mqtt from 'mqtt';
import { StringTemplateExpression, evaluateStringTemplate, parseStringTemplate, VariableExpression, LiteralStringExpression, ConcatenationExpression, literalExpression, concatenationExpression, variableExpression, expressionToFunction } from './StringTemplate';
import Aggregator from './Aggregator';

type TableFormat = {
	header: string;
	cellSeparator: string;
	rowSeparator: string;
	cells: StringTemplateExpression[][];
	noValuePlaceholder: string;
}

type ValueSet = {[k:string]: any};
/*
function formatTable(values:ValueSet, format:TableFormat):string {
	let chunk = [format.header];
	for( let r in format.cells ) {
		chunk.push(format.rowSeparator);
		const row = format.cells[r];
		let anyCellsOutput = false;
		for( let c in row ) {
			if( anyCellsOutput ) chunk.push(format.cellSeparator);
			const cell = row[c];
			chunk.push(evaluateStringTemplate(cell, values));
			anyCellsOutput = true;
		}
	}
	return chunk.join('');
}
*/

import * as fs from 'fs';
import { error } from 'util';
import { mkParentDirs } from './FSUtil';
import dateToIso8601 from './dateToIso8601';
import leftPad from './leftPad';

class FileAppender {
	constructor(protected filenameFunction:(Values:ValueSet)=>string) { }

	public push(chunk:string, vars:{[k:string]: any}):Promise<void> {
		const filename = this.filenameFunction(vars);
		return mkParentDirs(filename).then(() => new Promise<void>( (resolve,reject) => {
			fs.open(filename, "a", (error:NodeJS.ErrnoException, fd:number) => {
				if(error) { reject(error); return; }
				fs.write(fd, chunk, (writeError:NodeJS.ErrnoException, written:number, str:string) => {
					if(writeError) reject(writeError);
					fs.close(fd, (closeError:NodeJS.ErrnoException) => {
						if( closeError ) reject(closeError);
						else resolve();
					});
				});
			})
		}));
	}
}

class AggroLogger {
	mqttClient : mqtt.Client;
	aggregator : Aggregator;
	topicVariables : {[topic:string]: string} = {};

	public constructor(
		protected serverUrl:string,
		protected variableTopics:{[varName:string]: string},
		protected recordSetCallback:({[varName:string]: any}),
		reportInterval:number,
		logger:(values:ValueSet)=>Promise<void>
	) {
		let watchKeys = [];
		for( let varName in variableTopics ) {
			watchKeys.push(varName);
			this.topicVariables[variableTopics[varName]] = varName;
		}
		this.aggregator = new Aggregator(watchKeys, reportInterval, logger);
	}

	public start():Promise<void> {
		return new Promise<void>( (resolve,reject) => {
			this.mqttClient = mqtt.connect(this.serverUrl);
			this.mqttClient.on('message', (topic:string, data:Buffer) => {
				const value = data.toString(); // Maybe decoding should be configurable idk
				let varName = this.topicVariables[topic];
				if( varName == undefined ) return;
				this.aggregator.setValue(varName, +value);
			});
			this.mqttClient.on('connect', resolve);
			this.mqttClient.on('error', reject);
			console.log("# Attempting to connect to "+this.serverUrl+"...")
			this.aggregator.start();
		});
	}
}

function devAttrVars(devNames:string[], attrNames:string[], into:string[]=[]):string[] {
	for( let d in devNames ) for( let a in attrNames ) {
		into.push(devNames[d]+"/"+attrNames[a]);
	}
	return into;
}

function generateCsvChunkFormat(colNames:string[], headers=false) {
	let format:StringTemplateExpression[] = [];
	if(headers) {
		format.push(literalExpression("#COLUMNS:"));
	}
	format.push(headers ? literalExpression("date") : variableExpression("date:iso8601"));
	for( let d in colNames ) {
		format.push(literalExpression(","));
		format.push((headers ? literalExpression : variableExpression)(devNames[d]));
	}
	format.push(literalExpression("\n"));
	return concatenationExpression(format);
}

if( typeof module != 'undefined' && typeof require != 'undefined' && module == require.main ) {
	let serverUrl = "mqtt://localhost";
	const deviceNames = ['dht1','dht2'];
	const attrNames = ['temperature','humidity'];
	let filenameFormatString = "logs/test-{date:Y}_{date:m}_{date:d}.log";
	const filenameFormat = parseStringTemplate(filenameFormatString);
	// TODO: options to automatically generate table-based and csv formats for device/attribute
	const csvColNames = devAttrVars(deviceNames, attrNames);
	const chunkFormat = generateCsvChunkFormat(csvColNames);
	const reportInterval = 600;

	const fortifyVars = (values:ValueSet) => {
		let templateVars:ValueSet = {};
		const date = new Date();
		templateVars["date:Y"] = leftPad(date.getFullYear(), 2, '0');
		templateVars["date:m"] = leftPad(date.getMonth() + 1, 2, '0');
		templateVars["date:d"] = leftPad(date.getDate(), 2, '0');
		templateVars["date:iso8601"] = dateToIso8601(date,'second',false);
		templateVars["timestamp:iso8601"] = dateToIso8601(date,'second',true);
		for( let k in values ) templateVars[k] = values[k];
		return values;
	};

	const formatChunk = (values:ValueSet) => evaluateStringTemplate(chunkFormat, values);

	const fileAppender = new FileAppender(expressionToFunction(filenameFormat));
	const logger = (values:ValueSet) => {
		values = fortifyVars(values);
		const chunk = evaluateStringTemplate(chunkFormat, values);
		fileAppender.push(chunk, values);
	}
	
	const aggregator = new Aggregator(csvColNames, reportInterval, logger);
	aggregator.start();
	// And hopefully everything works out!
}
