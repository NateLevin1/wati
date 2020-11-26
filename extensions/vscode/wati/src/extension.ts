import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('wati is now active.');

	const wati: vscode.DocumentSelector = "wati";

	context.subscriptions.push(
		vscode.languages.registerHoverProvider(wati, new WatiHoverProvider)
	)
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider("wati", new WatiCompletionProvider, ".")
	);
	const curDoc = vscode.window.activeTextEditor?.document;
	if(curDoc) {
		updateFiles(curDoc);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}

// COMPLETION
class WatiCompletionProvider implements vscode.CompletionItemProvider {
	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		completionContext: vscode.CompletionContext
	): vscode.CompletionItem[]|undefined {
		const linePrefix = document.lineAt(position).text.substring(0, position.character);
		for(const shouldEndWith in completionItems) {
			if(linePrefix.endsWith(shouldEndWith)) {
				return completionItems[shouldEndWith];
			}
		}
		return undefined;
	}
}
const makeCompletionItem = (label: string, options?: CompletionItemOptions)=>{
	const item = new vscode.CompletionItem(label);
	for(const optionName in options) {
		let optionValue = options[optionName];
		if(optionValue) {
			// @ts-ignore
			item[optionName] = optionValue;
		}
		
	}
	return item;
}
interface CompletionItemOptions {
	[key: string]: unknown
	kind?: vscode.CompletionItemKind
	commitCharacters?: string[]
	documentation?: vscode.MarkdownString | string
	detail?: string
}
const setType = (arr: SharedCompletionItem[], type: "i32"|"i64"|"f32"|"f64")=>{
	return arr.map(v=>makeCompletionItem(v.label, {documentation: v.documentation ? new vscode.MarkdownString(v.documentation.replace(/TYPE/g, type)) : undefined, kind: v.kind ? v.kind : vscode.CompletionItemKind.Field}))
}
interface SharedCompletionItem {
	label: string
	documentation?: string
	kind?: vscode.CompletionItemKind
}
const sharedAllIAllF: SharedCompletionItem[] = [
	{ label: "load", documentation: "Push a value from memory onto the stack at a specified offset.\n```\n($offset i32) ($align i32) (result TYPE)\n```" },
	{ label: "store", documentation: "Store a value into memory at a specified offset.\n```\n($offset i32) ($newValue TYPE)\n```" },
	{ label: "const", documentation: "Create a constant number of the specified type. Easier syntax in wati is Ntype (e.g. '5i32')." },
]
const sharedAllI: SharedCompletionItem[] = [
	{ label: "load8_s" },
	{ label: "load8_u" },
	{ label: "load16_s" },
	{ label: "load16_u" },
	{ label: "store8" },
	{ label: "store16" },
	{ label: "clz" },
	{ label: "ctz" },
	{ label: "popcnt" },
	{ label: "add" },
	{ label: "sub" },
	{ label: "mul" },
	{ label: "div_s" },
	{ label: "div_u" },
	{ label: "rem_s" },
	{ label: "rem_u" },
	{ label: "and" },
	{ label: "or" },
	{ label: "xor" },
	{ label: "shl" },
	{ label: "shr_s" },
	{ label: "shr_u" },
	{ label: "rotl" },
	{ label: "rotr" },
	{ label: "eqz" },
	{ label: "eq" },
	{ label: "ne" },
	{ label: "lt_s" },
	{ label: "lt_u" },
	{ label: "gt_s" },
	{ label: "gt_u" },
	{ label: "le_s" },
	{ label: "le_u" },
	{ label: "ge_s" },
	{ label: "ge_u" },
]
const sharedAllF: SharedCompletionItem[] = [
	{ label: "abs" },
	{ label: "neg" },
	{ label: "ceil" },
	{ label: "floor" },
	{ label: "trunc" },
	{ label: "nearest" },
	{ label: "sqrt" },
	{ label: "add" },
	{ label: "sub" },
	{ label: "mul" },
	{ label: "div" },
	{ label: "min" },
	{ label: "max" },
	{ label: "copysign" },
	{ label: "eq" },
	{ label: "ne" },
	{ label: "lt" },
	{ label: "gt" },
	{ label: "le" },
	{ label: "ge" },
]
const completionItems: {[key: string]:vscode.CompletionItem[]} = {
	"i32.": [
		...setType(sharedAllIAllF, "i32"),
		...setType(sharedAllI, "i32"),
	],
	"i64.": [
		...setType(sharedAllIAllF, "i64"),
		...setType(sharedAllI, "i64"),
		makeCompletionItem("load32_s", { kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("load32_u", { kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("store32", { kind: vscode.CompletionItemKind.Field }),
	],
	"f32.": [
		...setType(sharedAllIAllF, "f32"),
		...setType(sharedAllF, "f32"),
	],
	"f64.": [
		...setType(sharedAllIAllF, "f64"),
		...setType(sharedAllF, "f64"),
	],
	"memory.": [
		makeCompletionItem("size", { documentation: "Returns the current size, in pages, of a memory.", kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("grow", { documentation: "Grows a memory by a given delta in page size and returns the previous size, or -1 if enough memory cannot be allocated.", kind: vscode.CompletionItemKind.Field }),
	],
	"local.": [
		makeCompletionItem("get", { documentation: "Get the value of a local variable.", kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("set", { documentation: "Set the value of a local variable.", kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("tee", { documentation: "The same as local.set except the argument is returned.", kind: vscode.CompletionItemKind.Field }),
	],
	"global.": [
		makeCompletionItem("get", { documentation: "Get the value of a global variable.", kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("set", { documentation: "Set the value of a global variable. Only succeeds if the variable is mutable.", kind: vscode.CompletionItemKind.Field }),
	],
	"i": [
		makeCompletionItem("i32", {kind:vscode.CompletionItemKind.Variable, commitCharacters:["."]}),
		makeCompletionItem("i64", {kind:vscode.CompletionItemKind.Variable, commitCharacters:["."]}),
		makeCompletionItem("if", {kind:vscode.CompletionItemKind.Variable }),
	],
	"f": [
		makeCompletionItem("f32", {kind:vscode.CompletionItemKind.Variable, commitCharacters:["."]}),
		makeCompletionItem("f64", {kind:vscode.CompletionItemKind.Variable, commitCharacters:["."]}),
	],
	"m": [
		makeCompletionItem("memory", {kind:vscode.CompletionItemKind.Variable, commitCharacters:["."]}),
	],
	"g": [
		makeCompletionItem("global", {kind:vscode.CompletionItemKind.Variable }),
	],
	"l": [
		makeCompletionItem("loop", {kind:vscode.CompletionItemKind.Variable }),
		makeCompletionItem("local", {kind:vscode.CompletionItemKind.Variable }),
	],
	"b": [
		makeCompletionItem("block", {kind:vscode.CompletionItemKind.Variable }),
		makeCompletionItem("br", {kind:vscode.CompletionItemKind.Variable }),
		makeCompletionItem("br_if", {kind:vscode.CompletionItemKind.Variable }),
	],
	"e": [
		makeCompletionItem("else", {kind:vscode.CompletionItemKind.Variable }),
		makeCompletionItem("end", {kind:vscode.CompletionItemKind.Variable }),
	],
	"u": [
		makeCompletionItem("unreachable", {kind:vscode.CompletionItemKind.Variable }),
	],
	"n": [
		makeCompletionItem("nop", {kind:vscode.CompletionItemKind.Variable }),
	],
	"r": [
		makeCompletionItem("return", {kind:vscode.CompletionItemKind.Variable }),
	],
	"c": [
		makeCompletionItem("call", {kind:vscode.CompletionItemKind.Variable }),
		makeCompletionItem("call_indirect", {kind:vscode.CompletionItemKind.Variable }),
	],
	"d": [
		makeCompletionItem("drop", {kind:vscode.CompletionItemKind.Variable }),
	],
	"s": [
		makeCompletionItem("select", {kind:vscode.CompletionItemKind.Variable }),
	],
}

// HOVER
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
		updateFiles(document);

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