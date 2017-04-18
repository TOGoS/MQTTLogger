import * as csvStringify from 'csv-stringify';
import * as fsu from './FSUtil';

function csvEncode(v:string):string {
	if( v.indexOf(',') != -1 || v.indexOf('"') != -1 ) {
		return '"'+v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')+'"';
	} else {
		return v;
	}
}

export default class LogToCSV {
	public minRecordSize = 1;
	// Set to '{}' to make me remember keys
	public keyMemory:{[k:string]: boolean}|undefined = undefined;
	public constructor(protected outStream:NodeJS.WritableStream, protected columns:string[], protected columnTitles:{[k:string]:string}={} ) {
	}
	public writeHeaders():boolean {
		const encoded:string[] = [];
		const cols = this.columns;
		for( let i=0; i<cols.length; ++i ) {
			const colName = cols[i];
			const title = this.columnTitles[colName] || colName;
			encoded.push(title);
		}
		return this.outStream.write(encoded.join(",")+"\n");
	}
	public writeRecord(values:{[k:string]: any}):boolean {
		const encoded:string[] = [];
		const cols = this.columns;
		if( this.keyMemory ) {
			for( let k in values ) this.keyMemory[k] = true;
		}
		let valueCount = 0;
		for( let i=0; i<cols.length; ++i ) {
			const colName = cols[i];
			const v = ""+(values[colName] || "");
			if( v != "" ) ++valueCount;
			encoded.push(v);
		}
		if( valueCount < this.minRecordSize ) return true;
		return this.outStream.write(encoded.join(",")+"\n");
	}
	public processLogFile( filename:string ):Promise<void> {
		return fsu.stat(filename).then( (stat) => {
			if( stat.isDirectory() ) {
				return fsu.readDir(filename).then( (entries) => {
					entries.sort();
					let prom = Promise.resolve();
					for( let e in entries ) {
						const subfile = filename+"/"+entries[e];
						prom = prom.then( () => this.processLogFile(subfile) );
					}
					return prom;
				});
			} else {
				return LogReader.instance.processFile(filename, (rec) => {
					this.writeRecord(rec.values);
					return Promise.resolve();
				});
			}
		})
	}
}

import LogReader from './LogReader';

if( typeof module != 'undefined' && typeof require != 'undefined' && require.main == module ) {
	let inputFilenames:string[] = [];
	let columnNames:string[] = [];
	let shouldWriteHeader:boolean = false;
	let minValueCount:number|undefined;
	const argv0 = process.argv[1];
	for( let i=2; i<process.argv.length; ++i ) {
		const arg = process.argv[i];
		if( arg == '-c' ) {
			let colnames = process.argv[++i].split(',');
			columnNames = columnNames.concat(colnames);
		} else if( arg == '--write-header' ) {
			shouldWriteHeader = true;
		} else if( arg.length == 0 ) {
			console.error(argv0+": Error: Weird empty argument #"+(i-1));
			process.exit(1);
		} else if( arg[0] != '-' || arg == '-' ) {
			inputFilenames.push(arg);
		}
	}
	if( minValueCount == undefined ) {
		minValueCount = 1; // By default filter out records that are completely empty
		for( let i=0; i<columnNames.length; ++i ) {
			if( columnNames[i] == 'timestamp' ) {
				// Lots of records have timestamps,
				// but if one doesn't have anything else, we probably don't care.
				minValueCount = 2;
			}
		}
	}
	if( inputFilenames.length == 0 ) {
		console.warn(argv0+": No input files");
	}
	const reader = new LogReader();
	const output = process.stdout;
	const converter = new LogToCSV(output, columnNames);
	converter.minRecordSize = minValueCount;
	if( columnNames.length == 0 ) {
		console.warn(argv0+": Warning: No headers specified; output will be blank");
		converter.keyMemory = {};
	}
	if( shouldWriteHeader ) converter.writeHeaders();
	let prom = Promise.resolve();
	for( let f in inputFilenames ) {
		const fn = inputFilenames[f];
		prom = prom.then( () => converter.processLogFile(fn) );
	}
	prom.then( () => {
		if( columnNames.length == 0 ) {
			// Give output a chance to flush
			setTimeout( () => {
				let keys = [];
				for( let k in converter.keyMemory||{} ) keys.push(k);
				console.warn(argv0+": Available columns: "+keys.join(', '));
			}, 100 );
		}
	}).catch( (err) => {
		console.error(err.stack);
		process.exitCode = 1;
	})
}
