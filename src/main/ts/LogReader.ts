///<reference types="node"/>

interface LSCRecord {
	text : string;
	values : {[k:string]: string};
	comment? : string;
};

import * as readline from 'readline';
import * as fs from 'fs';
import * as fsu from './FSUtil';
const dateRegex = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d(?::\d\d))$/;

export default class LogReader {
	protected processLine( line:string, callback:(m:LSCRecord)=>Promise<void>, filename:string="?", lineNumber:number ):Promise<void> {
		line = line.trim();
		if( line.length == 0 ) return Promise.resolve();

		let m:RegExpExecArray|null = /^([^#]*)(?:#\s*(.*))?\s*$/.exec(line);
		if( m == null ) {
			console.error("Ack, line parser didn't match on '"+line+"'");
			return Promise.resolve();
		}
		const body = m[1].trim();
		const comment = m[2];
		const parts = body.length > 0 ? body.split(/\s+/) : [];
		const values:{[k:string]:string} = {};
		for( let p in parts ) {
			const token = parts[p].trim();
			if( dateRegex.exec(parts[p]) ) {
				values['timestamp'] = parts[p];
			} else if( (m = /^([^:]+):(.*)$/.exec(parts[p])) ) {
				values[m[1]] = m[2];
			} else {
				console.warn("Unrecognized token: '"+token+"'");
			}
		}

		let record:LSCRecord = {
			text: line,
			values,
			comment,
		}
		return callback(record);
	}

	protected _processLines( lines:string[], start:number, callback:(m:LSCRecord)=>Promise<void>, filename:string="?", lineNumber:number ) {
		if( start >= lines.length ) return Promise.resolve();
		return this.processLine(lines[start], callback, filename, lineNumber).then( () => {
			this._processLines( lines, start+1, callback, filename, lineNumber+1 );
		})
	}

	protected processLines( lines:string[], callback:(m:LSCRecord)=>Promise<void>, filename:string="?", lineNumber:number=1 ) {
		return this._processLines(lines, 0, callback, filename, lineNumber);
	}
	
	public processStream( stream:NodeJS.ReadableStream, callback:(m:LSCRecord)=>Promise<void>, filename:string="?", lineNumber:number=1 ):Promise<void> {
		return new Promise<void>( (resolve,reject) => {
			const rl = readline.createInterface({
				input: stream,
				terminal: false
			});
			stream.on('error', reject);
			rl.on('line', (line) => {
				 this.processLine(line, callback, filename, lineNumber);
				 ++lineNumber;
			})
			rl.on('close', resolve);
		});
	}
	
	public processFile( filepath:string, callback:(m:LSCRecord)=>Promise<void> ):Promise<void> {
		return fsu.stat(filepath).then( (stat:fs.Stats) => {
			if( stat.isDirectory() ) {
				return fsu.readDir(filepath).then( entries => {
					let prom = Promise.resolve();
					for( let e in entries ) {
						prom = prom.then( () => {
							return this.processFile(filepath+"/"+entries[e], callback);
						});
					}
					return prom;
				});
			} else {
				const stream = fs.createReadStream(filepath, {encoding:"utf-8"});
				return this.processStream(stream, callback, filepath);
			}
		})
	}

	public static instance = new LogReader;
}
