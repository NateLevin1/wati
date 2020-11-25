import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('wati is now active.');

	const wati: vscode.DocumentSelector = "wati";

	context.subscriptions.push(
		vscode.languages.registerHoverProvider(wati, new WatiHoverProvider)
	)
	const curDoc = vscode.window.activeTextEditor?.document;
	if(curDoc) {
		updateFiles(curDoc);
	}
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(updateFiles)
	)
}

// this method is called when your extension is deactivated
export function deactivate() {}

const files: IFileVariables = {};
const getVariablesInFile = (document: vscode.TextDocument): VariablesInFile=>{
	const returned: VariablesInFile = {globals: {}, functions: {}}
	const text = document.getText();
	let globals = [...text.matchAll(getGlobals)];
	globals.forEach((match)=>{
		returned.globals[match[1]] = {type: match[3] as VariableType, isMutable: match[2] === "mut", name:match[1]}
	});
	let functions = [...text.matchAll(getFunctions)];
	functions.forEach((match)=>{
		const paramString = match[2];
		let parameters: Variable[] = [];
		if (paramString) {
			const paramMatch = [...paramString.matchAll(getParamsOrLocals)];
			parameters = paramMatch.map(getNameType);
		}

		const localString = match[4];
		let locals: VariableByName = {};
		if (localString) {
			const localMatch = [...localString.matchAll(getParamsOrLocals)];
			const localsArr = localMatch.map(getNameType);
			for (const nameAndType of localsArr) {
				if (nameAndType.name) {
					locals[nameAndType.name] = nameAndType;
				}
			}
		}

		returned.functions[match[1]] = {
			name: match[1],
			returnType: !match[3] ? null : match[3] as VariableType,
			parameters,
			locals
		};
	});
	return returned;
}
const updateFiles = (document: vscode.TextDocument)=>{
	if(document.languageId === "wati") {
		files[document.uri.path] = getVariablesInFile(document);
		console.log(files);
	}
}
const getNameType = (m: RegExpMatchArray)=>{
	let name: string|undefined;
	let type: VariableType = "unknown";
	m.forEach((v: string|VariableType|null)=>{
		// if v starts with $ it is the name,
		// if v doesn't and it is not null
		// it is the type 
		if(v?.startsWith("$")) {
			name = v;
		} else if(!!v) {
			type = v as VariableType;
		}
	});
	return {name, type}
}
const getGlobals = /\(global (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (?:\((mut) *)*(i32|i64|f32|f64)/g;
const getParamsOrLocals = /(?: *\((?:(?:param|local) +(?:(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) +)*(i32|i64|f32|f64)|(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (i32|i64|f32|f64))| (i32|i64|f32|f64))/g;
const getFunctions = /\((?:func)[^$]+(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)(?: |\(export[^)]+\))*((?:\((?:param | *\$)[^)]+\) *)+)*(?:\(result (i32|i64|f32|f64)\) *)*((?:\(local \$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]* (?:i32|i64|f32|f64)\) *)+)*/g;
const getFuncNameFromLine = /\((?:func)[^$]+(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)/;
const isLineAFunc = /\(func/;

class WatiHoverProvider implements vscode.HoverProvider {
	public provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
		): vscode.Hover|null
	{
		const word = document.getText(document.getWordRangeAtPosition(position, /[^ ();]+/));
		const char = document.getText(new vscode.Range(position, new vscode.Position(position.line, position.character+1)));

		// get the current function
		// this is a hacky solution but since it is only used for local vars it works fine
		let curFunc: string|undefined;
		let curLineNum = position.line;
		while(curLineNum > 0) {
			const curLine = document.lineAt(curLineNum).text;
			if(isLineAFunc.test(curLine)) {
				// line is a func
				curFunc = curLine.match(getFuncNameFromLine)?.[1];
				break;
			}
			curLineNum -= 1;
		}

		// the chars that should never have a hover
		switch(char) {
			case " ":
			case "=":
			case ";":
			case "(":
			case ")":
				return null;
		}

		const file = files[document.uri.path];

		if(word.startsWith("$")) {
			// it is a global variable, local variable, function or label

			// FUNCTION
			const func = file.functions[word];
			if(func) {
				// it is a func
				const out = new vscode.MarkdownString();
				out.appendCodeblock(`(func ${func.name}${func.parameters.length === 0 ? "" : " "}${func.parameters.map((v)=>`(${v.name} ${v.type})`).join(" ")})\n(result${func.returnType ? " "+func.returnType : ""})`);
				return new vscode.Hover(out);
			}
			
			// GLOBAL VARIABLE
			const valAtGlobal = file.globals[word]
			if(valAtGlobal) {
				const out = new vscode.MarkdownString();
				out.appendCodeblock(`(global ${valAtGlobal.name} ${valAtGlobal.type}) ${valAtGlobal.isMutable === true ? "(mut)" : ""}`, 'wati');
				return new vscode.Hover(out);
			}

			// LOCAL VARIABLE
			if(curFunc) { // must be in a function for a local var
				const valAtLocal = file.functions[curFunc].locals[word];
				if(valAtLocal) {
					const out = new vscode.MarkdownString();
					out.appendCodeblock(`(local ${valAtLocal.name} ${valAtLocal.type})`, 'wati');
					return new vscode.Hover(out);
				}
			}

			// if nothing else has matched, just be unknown
			// ? Show red underline?
			return new vscode.Hover(`\tunknown`);
		}
		return new vscode.Hover(`${word}\n\nline: ${position.line}\ncharacter: ${position.character}`);
	}
}


interface IFileVariables {
	[key: string]: VariablesInFile
}
interface VariablesInFile {
	globals: VariableByName
	functions: {[key: string]: FunctionDescriptor}
}
interface FunctionDescriptor {
	// includes the $
	name: string
	parameters: Variable[]
	returnType: VariableType
	locals: VariableByName
}
interface VariableByName {
	// includes the $
	[key: string]: Variable
}
interface Variable {
	type: VariableType
	isMutable?: boolean
	name: string|undefined // includes the $, is undefined if no name (just indexed)
}
type VariableType = "i32"|"i64"|"f32"|"f64"|"unknown"|null;