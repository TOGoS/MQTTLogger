import leftPad from './leftPad';

export default function dateToIso8601(date:Date):string {
	var timezoneOffsetTotalMinutes = date.getTimezoneOffset();
	var timezoneOffsetTotalMinutesAbs = Math.abs(timezoneOffsetTotalMinutes);
	var timezoneOffsetHours = Math.floor(timezoneOffsetTotalMinutesAbs / 60);
	var timezoneOffsetMinutes = timezoneOffsetTotalMinutesAbs - 60 * timezoneOffsetHours;
	var
		y = leftPad(date.getFullYear(), 4, "0"),
		m = leftPad(date.getMonth() + 1, 2, "0"),
		d = leftPad(date.getDate(), 2, "0"),
		h = leftPad(date.getHours(), 2, "0"),
		i = leftPad(date.getMinutes(), 2, "0"),
		s = leftPad(date.getSeconds(), 2, "0"),
		zh = leftPad(timezoneOffsetHours, 2, "0"),
		zm = leftPad(timezoneOffsetMinutes, 2, "0");
	let zSep;
	if( timezoneOffsetTotalMinutes < 0 ) {
		// http://stackoverflow.com/questions/21102435/why-does-javascript-date-gettimezoneoffset-consider-0500-as-a-positive-off
		zSep = '+';
		zh = -zh;
	} else {
		zSep = '-';
	}
	return y + "-" + m + "-" + d + "T" + h + ":" + i + ":" + s + zSep + zh + ":" + zm;
}
