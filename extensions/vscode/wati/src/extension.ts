import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('wati is now active.');

	const wati: vscode.DocumentSelector = "wati";

	context.subscriptions.push(
		vscode.languages.registerHoverProvider(wati, new WatiHoverProvider)
	);
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(wati, new WatiCompletionProvider, ".", "$")
	);
	context.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider(wati, new WatiSignatureHelpProvider, '(', ',')
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}

// SIGNATURE HELP
class WatiSignatureHelpProvider implements vscode.SignatureHelpProvider {
	public provideSignatureHelp(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		sigHelpContext: vscode.SignatureHelpContext
	): vscode.SignatureHelp|undefined {
		if (sigHelpContext.triggerKind === 2) {
			const sigHelp = sigHelpContext.activeSignatureHelp ?? new vscode.SignatureHelp;

			// determine the most recent call so we know what to show
			const strFromLastCall = getCallAtCursor(document.lineAt(position).text, position.character);

			// get the name and args of the function and show them
			const match = strFromLastCall.match(getNameAndParamOfCall);
			if (match) {
				// we need to update files so that we know if the func exists
				updateFiles(document);
				const [full, name, args] = match;
				const funcRef = files[document.uri.path].functions[name];
				if (funcRef) {
					const sig = new vscode.SignatureInformation(getStringFromFuncRef(funcRef));
					sig.parameters = [...funcRef.parameters.filter(p=>!!p.name).map(p=>new vscode.ParameterInformation(`(${(p as any).name} ${p.type})`))]
					sigHelp.activeParameter = (args.match(/,/g) ?? []).length;
					sigHelp.activeSignature = 0;
					sigHelp.signatures = [sig];
					return sigHelp;
				} else {
					sigHelp.activeParameter = 0;
					sigHelp.activeSignature = 0;
					sigHelp.signatures = [new vscode.SignatureInformation("unknown function \""+name+"\"")]
					return sigHelp;
				}
			} else {
				return undefined;
			}
		} else {
			const sigHelp = sigHelpContext.activeSignatureHelp ?? new vscode.SignatureHelp;
			return sigHelp;
		}
	}
}
const getCallAtCursor = (line: string, cursorPos: number, previousLine?: string): string=>{
	let openParenIndex = line.indexOf("(");
	if(openParenIndex !== -1) {
		if (openParenIndex !== -1) {
			let args = line.slice(openParenIndex + 1);
			// find close paren index
			let numOfParens = 1;
			let curCharIndex = 0;
			while (numOfParens > 0 && curCharIndex < args.length) {
				const curChar = args[curCharIndex];
				if(curChar === "(") {
					numOfParens++;
				} else if(curChar === ")") {
					numOfParens--;
				}
				curCharIndex++;
			}
			// get the absolute location of the end paren
			let closeParenIndex = curCharIndex + openParenIndex;
			if(cursorPos > openParenIndex && cursorPos < closeParenIndex + 1) {
				// cursor is between the opening and closing parens, check for more calls
				return getCallAtCursor(line.slice(openParenIndex + 1, closeParenIndex), cursorPos - openParenIndex - 1, line);
			} else {
				// it isn't between the two, should be the last one or if there is another ( we keep trying
                const nextOpenParam = line.slice(openParenIndex + 1).indexOf("(");
                if(nextOpenParam !== -1) {
                    return getCallAtCursor(line.slice(closeParenIndex + 1), cursorPos - closeParenIndex - 1, previousLine);
                } else {
				    return previousLine ?? line;
                }
			}
		}
	} else {
		return previousLine ?? line;
	}
    return previousLine ?? line;
}

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
		if (linePrefix.endsWith("$")) {
			// show available functions/variables. blocks are unsupported currently
			updateFiles(document);
			if (linePrefix.endsWith("call $")) {
				// show available funcs
				return Object.values(files[document.uri.path].functions).map(({name, parameters, returnType})=>makeCompletionItem(name.slice(1), {detail: /**The flatMap makes sure there are only two displayed on each line */`${parameters.flatMap((p, i)=>{let str = `(${p.name} ${p.type}) `; if((i + 1) % 2 === 0) return [str, "\n"]; return [str]}).join("")}${parameters.length > 0 ? "\n\n" : ""}result ${returnType}`}))
			} else {
				const curFunc = getCurFunc(document, position);
				return [
					...Object.values(files[document.uri.path].globals).filter(v=>!!v.name).map((v)=>makeCompletionItem((v as {name: string}).name.slice(1), {detail: `(global) ${(v as {type: string}).type}`})), 
					...(!!curFunc ?
						[
							...Object.values(files[document.uri.path].functions[curFunc].locals).filter(v=>!!v.name).map((v)=>makeCompletionItem((v as {name: string}).name.slice(1), {detail: `(local) ${(v as {type: string}).type}`})),
							...files[document.uri.path].functions[curFunc].parameters.filter(v=>!!v.name).map((v)=>makeCompletionItem((v as {name: string}).name.slice(1), {detail: `(param) ${(v as {type: string}).type}`}))
						]
						: []
					   )
				];
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

// documentation shared between hovers and completion
const uniDocs: {[instruction: string]: string} = {
	"TYPE.load": "Push a value from memory onto the stack at a specified offset.\n```\n($offset i32) ($align i32) (result TYPE)\n```",
	"TYPE.store": "Store a value into memory at a specified offset.\n```\n($offset i32) ($newValue TYPE)\n```",
	"TYPE.const": "Create a constant number of the specified type. Easier syntax in wati is \n```\n5i32\n```",
	"TYPE.add": "Add the top two values on the stack and return the result.\n```\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.sub": "Subtract the top two values on the stack and return the result.\n```\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.mul": "Multiply the top two values on the stack and return the result.\n```\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.eq": "Check if parameter 1 and parameter 2 are equal. Returns true (`1i32`) if they are and false (`0i32`) if they aren't.\n```\n($param1 TYPE) ($param2 TYPE) (result i32)\n```",
	"TYPE.ne": "Check if parameter 1 and parameter 2 are not equal. Returns true (`1i32`) if they are not equal and false (`0i32`) if they are equal.\n```\n($param1 TYPE) ($param2 TYPE) (result i32)\n```",
	"i32.eqz": "Check if parameter 1 is equal to zero. Returns true (`1i32`) if it is equal to zero and false (`0i32`) if it is not.\n```\n($param TYPE) (result i32)\n```",
	"i64.eqz": "Check if parameter 1 is equal to zero. Returns true (`1i32`) if it is equal to zero and false (`0i32`) if it is not.\n```\n($param TYPE) (result i32)\n```",
	// "TYPE.": "",
}
const sharedAllIAllF: SharedCompletionItem[] = [
	{ label: "load", documentation: uniDocs["TYPE.load"] },
	{ label: "store", documentation: uniDocs["TYPE.load"] },
	{ label: "const", documentation: uniDocs["TYPE.const"] },
	{ label: "add", documentation: uniDocs["TYPE.add"] },
	{ label: "sub", documentation: uniDocs["TYPE.sub"] },
	{ label: "mul", documentation: uniDocs["TYPE.mul"] },
	{ label: "eq", documentation: uniDocs["TYPE.eq"] },
	{ label: "ne", documentation: uniDocs["TYPE.ne"] },
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
	{ label: "eqz", documentation: uniDocs["i32.eqz"] },
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
	{ label: "div" },
	{ label: "min" },
	{ label: "max" },
	{ label: "copysign" },
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
		makeCompletionItem("stack", {kind:vscode.CompletionItemKind.Variable }),
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
const getNameAndParamOfCall = /call (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)(\((?:[^,\n]*(?:,|\)))*)/;

const getCurFunc = (document: vscode.TextDocument, position: vscode.Position)=>{
	// this is a hacky solution but since it is only used for local vars it works fine
	let curFunc: string | undefined;
	let curLineNum = position.line;
	while (curLineNum > 0) {
		const curLine = document.lineAt(curLineNum).text;
		if (isLineAFunc.test(curLine)) {
			// line is a func
			curFunc = curLine.match(getFuncNameFromLine)?.[1];
			break;
		}
		curLineNum -= 1;
	}
	return curFunc;
}

const getStringFromFuncRef = (func: FunctionDescriptor)=>{
	return `(func ${func.name}${func.parameters.length === 0 ? "" : " "}${func.parameters.map((v)=>`(${v.name} ${v.type})`).join(" ")})\n(result${func.returnType ? " "+func.returnType : ""})`
}

class WatiHoverProvider implements vscode.HoverProvider {
	public provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
		): vscode.Hover|null
	{
		updateFiles(document);

		const word = document.getText(document.getWordRangeAtPosition(position, /[^ ();,]+/));
		const char = document.getText(new vscode.Range(position, new vscode.Position(position.line, position.character+1)));

		// get the current function
		const curFunc = getCurFunc(document, position);

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
				out.appendCodeblock(getStringFromFuncRef(func));
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

			// FUNCTION PARAMETER
			if(curFunc) { // must be in a function for a local var
				const paramRef = file.functions[curFunc].parameters;
				const wordIndex = paramRef.findIndex(v=>v.name === word);
				const valAtParam = wordIndex !== -1 ? paramRef[wordIndex] : undefined;
				if(valAtParam) {
					const out = new vscode.MarkdownString();
					out.appendCodeblock(`(local ${valAtParam.name} ${valAtParam.type})`, 'wati');
					return new vscode.Hover(out);
				}
			}
			
			// if nothing else has matched, just be unknown
			// ? Show red underline?
			return new vscode.Hover(`\tunknown`);
		} else {
			// might be an instruction or just a random word
			const capturedWord = word.match(/(i32|i64|f32|f64)\.(\S+)/);
			if(capturedWord) {
				// is an instruction
				let doc = uniDocs["TYPE."+capturedWord[2]]; // check if there is a global type
				doc = !!doc ? doc : uniDocs[`${capturedWord[1]}.${capturedWord[2]}`]; // if there isn't, check if there is a more specific type
				return new vscode.Hover(`${!!doc ? doc.replace(/TYPE/g, capturedWord[1]) : "No documentation available."}`);
			}
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