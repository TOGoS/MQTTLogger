export default class MQTTURLOption {
	protected host:string|undefined = undefined;
	protected port:number|undefined = undefined;
	protected url:string|undefined = undefined;

	public setUrl(url:string):void {
		if( this.host != undefined || this.port != undefined ) {
			throw new Error("Tried to set MQTT URL when hostname alreay provided");
		}
		if( this.url != undefined ) {
			throw new Error("MQTT URL already specified");
		}
		this.url = url;
	}

	public setHost(host:string):void {
		if( /:\/\//.exec(host) ) {
			this.setUrl(host);
		} else {
			if( this.url != undefined ) {
				throw new Error("Tried to set MQTT hostname when URL already provided")
			}
			if( this.host != undefined ) {
				throw new Error("MQTT hostname already specified")
			}
			this.host = host;
		}
	}

	public setPort(port:number|string):void {
		port = +port;
		if( this.port != undefined ) throw new Error("MQTT port already specified");
		if( this.url != undefined ) throw new Error("Tried to set MQTT port when URL already provided");
		this.port = port;
	}

	getUrl():string {
		if( this.url )
			return this.url;
		if( this.host ) {
			let hostPart = this.host;
			if( /^[0-9a-fA-F:]*:[0-9a-fA-F:]*$/.exec(hostPart) ) {
				hostPart = "["+hostPart+"]";
			}
			if( this.port != undefined ) hostPart += ":"+this.port;
			return "mqtt://"+hostPart;
		}
		throw new Error("No MQTT host or URL specified");
	}
}

if( typeof module != 'undefined' && typeof require != 'undefined' && module == require.main ) {
	// test it
	let serverOpt:MQTTURLOption = new MQTTURLOption();
	let args = process.argv;
	try {
		for( let i=2; i<args.length; ++i ) {
			let arg = args[i];
			if( arg == '-h' ) {
				serverOpt.setHost(args[++i]);
			} else if( arg == '-p' ) {
				serverOpt.setPort(args[++i]);
			} else {
				throw new Error("Unrecognized argument: "+arg);
			}
		}
		console.log(serverOpt.getUrl());
	} catch( err ) {
		console.error(err.stack);
		process.exit(1);
	}
}
