export default function leftPad( thing:any, len:number, char:string=" " ) {
	thing = ""+thing;
	while( thing.length < len ) thing = char + thing;
	return thing;
}
