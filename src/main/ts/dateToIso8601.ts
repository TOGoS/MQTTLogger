import leftPad from './leftPad';

export default function dateToIso8601(date:Date, to='seconds', includeTimezone=true):string {
	let timezoneOffsetTotalMinutes = date.getTimezoneOffset();
	let timezoneOffsetTotalMinutesAbs = Math.abs(timezoneOffsetTotalMinutes);
	let timezoneOffsetHours = Math.floor(timezoneOffsetTotalMinutesAbs / 60);
	let timezoneOffsetMinutes = timezoneOffsetTotalMinutesAbs - 60 * timezoneOffsetHours;
	let formatted = '';
	let
		y = leftPad(date.getFullYear(), 4, "0"),
		m = leftPad(date.getMonth() + 1, 2, "0"),
		d = leftPad(date.getDate(), 2, "0"),
		h = leftPad(date.getHours(), 2, "0"),
		i = leftPad(date.getMinutes(), 2, "0"),
		s = leftPad(date.getSeconds(), 2, "0"),
		zh = leftPad(timezoneOffsetHours, 2, "0"),
		zm = leftPad(timezoneOffsetMinutes, 2, "0");
	// TODO: mind 'to'

	formatted = y + "-" + m + "-" + d + "T" + h + ":" + i + ":" + s;
	if( includeTimezone ) {
		let zSep;
		if( timezoneOffsetTotalMinutes < 0 ) {
			// http://stackoverflow.com/questions/21102435/why-does-javascript-date-gettimezoneoffset-consider-0500-as-a-positive-off
			zSep = '+';
			zh = -zh;
		} else {
			zSep = '-';
		}
		formatted += zSep + zh + ":" + zm;
	}
	return formatted;
}
