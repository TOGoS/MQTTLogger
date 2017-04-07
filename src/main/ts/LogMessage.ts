interface LogMessage {
	text : string; // Original message as received
	topic : string;
	receivedTime : Date;
	explicitTime? : Date;
	nodeId? : string;
	comment? : string;
}

export default LogMessage;