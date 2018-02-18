export interface LiteralStringExpression {
	classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralString";
	literalValue: string;
}

export interface VariableExpression {
	classRef: "http://ns.nuke24.net/TOGVM/Expressions/Variable";
	variableName: string;
}

export interface ConcatenationExpression {
	// Ahh, should add this to TOGVM-Spec
	classRef: "http://ns.nuke24.net/TOGVM/Expressions/Concatenation";
	componentExpressions: StringTemplateExpression[];
}

export type StringTemplateExpression = LiteralStringExpression | VariableExpression | ConcatenationExpression;

type Context = {[k:string]:string};

export function parseStringTemplate( template:string ):StringTemplateExpression {
	let componentExpressions:StringTemplateExpression[] = [];
	let openBracePos:number;
	let currentPos = 0;
	while( (openBracePos = template.indexOf("{",currentPos)) != -1 ) {
		if( openBracePos > currentPos ) {
			componentExpressions.push({
				classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralString",
				literalValue: template.substring(currentPos, openBracePos),
			});
		}
		let closeBracePos = template.indexOf("}",openBracePos+1)
		if( closeBracePos == -1 ) {
			throw new Error("No matching close brace for open brace at "+openBracePos+" in expression: "+template);
		}
		let variableName = template.substring(openBracePos+1,closeBracePos);
		if( variableName.length == 0 ) {
			throw new Error("Zero length variable at "+(openBracePos+1)+" in expression: ")
		}
		if( variableName ) {
			componentExpressions.push({
				classRef: "http://ns.nuke24.net/TOGVM/Expressions/Variable",
				variableName
			});
		}
		currentPos = closeBracePos+1;
	}
	if( currentPos < template.length ) {
		componentExpressions.push({
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralString",
			literalValue: template.substring(currentPos, template.length),
		});
	}
	if( componentExpressions.length == 0 ) {
		return {
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralString",
			literalValue: ""
		};
	} else if( componentExpressions.length == 1 ) {
		return componentExpressions[0];
	} else {
		return {
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/Concatenation",
			componentExpressions
		}
	}
}

export function evaluateStringTemplate( expression:StringTemplateExpression, variables:Context ):string {
	switch( expression.classRef ) {
	case "http://ns.nuke24.net/TOGVM/Expressions/Concatenation":
		let parts = [];
		for( let e in expression.componentExpressions ) {
			parts.push(evaluateStringTemplate(expression.componentExpressions[e], variables));
		}
		return parts.join("");
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralString":
		return expression.literalValue;
	case "http://ns.nuke24.net/TOGVM/Expressions/Variable":
		return ""+(variables[expression.variableName] || "(undefined variable '"+expression.variableName+"')");
	}
}

export function literalExpression(literalValue:string):LiteralStringExpression {
	return {
		classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralString",
		literalValue
	}
}
export function variableExpression(variableName:string):VariableExpression {
	return {
		classRef: "http://ns.nuke24.net/TOGVM/Expressions/Variable",
		variableName
	}
}
export function concatenationExpression(componentExpressions:StringTemplateExpression[]):ConcatenationExpression {
	return {
		classRef: "http://ns.nuke24.net/TOGVM/Expressions/Concatenation",
		componentExpressions
	}
}
export function expressionToFunction(expr:StringTemplateExpression):(vars:Context)=>string {
	return (vars:Context) => evaluateStringTemplate(expr, vars);
}
