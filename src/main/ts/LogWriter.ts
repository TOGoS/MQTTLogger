import LogMessage from './LogMessage';
import { mkParentDirs } from './FSUtil';
import * as fs from 'fs';
import dateToIso8601 from './dateToIso8601';
import leftPad from './leftPad';

function encodeTopicName( topicName:string ):string {
	return topicName.replace(/[\/\.]+/g, '-').replace(/[^A-Za-z0-9_\-]/g, '');
}

interface LogStreamInfo {
	minTs : Date;
	maxTs : Date;
	filename : string;
	streamPromise : Promise<NodeJS.WritableStream>;
}

export default class LogWriter {
	/**
	 * Maximimum difference to allow incoming timestamps from our idea of current time before clamping, in milliseconds
	 */
	public maxDrift = 1000 * 60 * 5;
	/**
	 * Name of directory in which to write logs (will be further subdivided into subdirectories)
	 */ 
	public logRoot:string = "logs"; 
	
	// For purposes of writing log messages,
	// clamp dates between minTs and maxTs
	// which should be based on currentTs += some minutes
	protected _minTs:Date;
	protected _currentTs:Date;
	protected _maxTs:Date;
	
	protected _logFilename( encodedTopic:string, ts:Date ) {
		const
			y = leftPad(ts.getFullYear(), 4, "0"),
			m = leftPad(ts.getMonth()+1, 2, "0"),
			d = leftPad(ts.getDate(), 2, "0");
		
		return this.logRoot+"/"+y+"/"+m+"/"+y+"_"+m+"_"+d+"/"+encodedTopic+"-"+y+"-"+m+"-"+d+".log";
	}
	
	protected streamCache:{[k:string]: LogStreamInfo} = {};
	protected topicStreamInfo( topic:string, ts:Date ):LogStreamInfo {
		const
			y = leftPad(ts.getFullYear(), 4, "0"),
			m = leftPad(ts.getMonth()+1, 2, "0"),
			d = leftPad(ts.getDate(), 2, "0"),
			encodedTopic = encodeTopicName(topic);
		
		let key = encodedTopic+"-"+y+"-"+m+"-"+d;
		
		if( this.streamCache[key] == undefined ) {
			const filename = this._logFilename(encodedTopic, ts);
			const streamPromise = mkParentDirs(filename).then( () => {
				let stream = fs.createWriteStream(filename, {
					flags: 'a',
					mode: 0o664,
				});
				stream.once('error', (err:Error) => {
					console.error("Error writing to "+filename+"; closing: "+err.stack);
					stream.close();
				});
				return stream;
			});
			streamPromise.catch( (err:Error) => {
				console.error("Error opening write stream for "+filename+": "+err.stack);
			})
			this.streamCache[key] = {
				minTs: new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()+0),
				maxTs: new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()+1),
				filename,
				streamPromise,
			}
		}
		return this.streamCache[key];
	}
	
	protected set currentTs(ts:Date) {
		this._currentTs = ts;
		this._minTs = new Date(ts.getTime() - this.maxDrift);
		this._maxTs = new Date(ts.getTime() + this.maxDrift);
	}
	
	public message( m:LogMessage ):void {
		let ts = m.explicitTime || m.receivedTime;

		// Use receivedTimes so that in case there's multiple writers,
		// we don't accidentally go backwards.
		if( m.receivedTime > this._currentTs ) {
			this.currentTs = m.receivedTime;
		}
		
		let clamped = false;
		if( ts < this._minTs ) {
			ts = this._minTs;
			clamped = true;
		}
		if( ts > this._maxTs ) {
			ts = this._maxTs;
			clamped = true;
		}
		
		let line = (m.explicitTime == undefined ? dateToIso8601(ts) + " " : "") + m.text;
		const topicStreamInfo = this.topicStreamInfo(m.topic, ts);
		topicStreamInfo.streamPromise.then( (writeStream) => {
			if( clamped ) {
				writeStream.write("# Extreme timestamp difference; following was received at "+dateToIso8601(m.receivedTime));
			}
			writeStream.write(line+"\n");
		});
	}

	public closeOldStreams() {
		this.currentTs = new Date();

		for( let k in this.streamCache ) {
			const streamInfo = this.streamCache[k];
			if(
				streamInfo.maxTs <= this._minTs ||
				streamInfo.minTs >  this._maxTs
			) {
				streamInfo.streamPromise.then( (stream:NodeJS.WritableStream) => {
					stream.end();
				}).catch( (err:Error) => {
					console.error("Failed to close stream for "+streamInfo.filename+": "+err.message);
				});
				delete this.streamCache[k];
			}
		}
	}
	
	public startAutoCleanup() {
		setInterval( this.closeOldStreams.bind(this), 1000 * 60 );
	}
}
