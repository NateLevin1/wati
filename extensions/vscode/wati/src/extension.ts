import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('wati is now active.');

	const wati: vscode.DocumentSelector = "wati";
	const wat: vscode.DocumentSelector = "wat";

	// WATI
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(wati, new WatiHoverProvider)
	);
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(wati, new WatiVariableCompletionProvider, ".", "$", "@")
	);
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(wati, new WatiSyntaxCompletionProvider, ...WatiSyntaxCompletionProvider.triggerCharacters)
	);
	context.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider(wati, new WatiSignatureHelpProvider, '(', ',')
	);
	// WAT
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(wat, new WatiHoverProvider)
	);
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(wat, new WatiVariableCompletionProvider, ".", "$", "@")
	);
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(wat, new WatiSyntaxCompletionProvider, ...WatiSyntaxCompletionProvider.triggerCharacters)
	);
	context.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider(wat, new WatiSignatureHelpProvider, '(', ',')
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
		// disable if wat and not on in wat
		if(document.languageId === "wat" && !vscode.workspace.getConfiguration('wati').useIntellisenseInWatFiles) {
			return undefined;
		}
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
const mapVariables = ({prefix, wasmInstr, variables, position, wasmAfterVar, command }: {prefix: string, wasmInstr: string, variables: vscode.CompletionItem[], position: vscode.Position, wasmAfterVar?: string, command?: vscode.Command })=>{
	return variables.map((completionItem)=>{
		const varName = completionItem.label;
		const fullTypedText = prefix + "$" + varName;
		const textToInsert = `(${wasmInstr} $${varName}${wasmAfterVar ?? ""})`;
		return makeCompletionItem(fullTypedText, {
			range: new vscode.Range(position.with(undefined, position.character - prefix.length - 1), position),
			insertText: textToInsert,
			documentation: new vscode.MarkdownString(completionItem.detail + "\n```wasm\n"+ textToInsert +"\n```"),
			command: command,
		});
	});
}
class WatiVariableCompletionProvider implements vscode.CompletionItemProvider {
	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		completionContext: vscode.CompletionContext
	): vscode.CompletionItem[]|undefined {
		// disable if wat and not on in wat
		if(document.languageId === "wat" && !vscode.workspace.getConfiguration('wati').useIntellisenseInWatFiles) {
			return undefined;
		}
		const linePrefix = document.lineAt(position).text.substring(0, position.character);
		for(const shouldEndWith in completionItems) {
			if(linePrefix.endsWith(shouldEndWith)) {
				return completionItems[shouldEndWith];
			}
		}
		if (linePrefix.endsWith("$")) {
			// show available functions/variables.
			updateFiles(document);

			if (linePrefix.endsWith("call $")) {
				// show available funcs
				return Object.values(files[document.uri.path].functions).filter((value)=>!value.name.startsWith("__WATI_EXPORTED__")).map(({name, parameters, returnType})=>makeCompletionItem(name.slice(1), {detail: /**The flatMap makes sure there are only two displayed on each line */`${parameters.flatMap((p, i)=>{let str = `(${p.name ? p.name+" " : ""}${p.type}) `; if((i + 1) % 2 === 0) return [str, "\n"]; return [str]}).join("")}${parameters.length > 0 ? "\n\n" : ""}(result${returnType ? " "+returnType : ""})`}))
			}

			const curFunc = getCurFunc(document, position);

			const isBranch = linePrefix.match(/br(?:_if)?\s*\$$/);
			if(curFunc && isBranch) {
				return [
					...Object.values(files[document.uri.path].functions[curFunc].blocks).map((v)=>makeCompletionItem(({name: v.label}).name.slice(1), {detail: `${v.type} ${v.label} on line ${v.lineNum}`})),
				];
			}

			const isLocalVar = linePrefix.endsWith("l$");
			const localVariables = !!curFunc
				? [
					...Object.values(files[document.uri.path].functions[curFunc].locals).filter(v=>!!v.name).map((v)=>makeCompletionItem((v as {name: string}).name.slice(1), {detail: `(local) ${v.type}`})),
					...files[document.uri.path].functions[curFunc].parameters.filter(v=>!!v.name).map((v)=>makeCompletionItem((v as {name: string}).name.slice(1), {detail: `(param) ${v.type}`}))
					]
				: [];

			if(isLocalVar) {
				return mapVariables({prefix: "l", wasmInstr: "local.get", variables: localVariables, position});
			}

			const isSettingLocalVar = linePrefix.endsWith("l=$");
			if(isSettingLocalVar) {
				return mapVariables({
					prefix: "l=",
					wasmInstr: "local.set",
					variables: localVariables,
					position,
					wasmAfterVar: " ",
					command: {
						command: "cursorMove",
						title: "Cursor Move",
						arguments: [{ to: "left" }],
					}
				});
			}

			const isGlobalVar = linePrefix.endsWith("g$");
			const globalVariables = Object.values(files[document.uri.path].globals).filter(v=>!!v.name).map((v)=>makeCompletionItem((v as {name: string}).name.slice(1), {detail: `(global) ${v.type}`}));

			if(isGlobalVar) {
				return mapVariables({prefix: "g", wasmInstr: "global.get", variables: globalVariables, position});
			}

			const isSettingGlobalVar = linePrefix.endsWith("g=$");
			if(isSettingGlobalVar) {
				return mapVariables({
					prefix: "g=",
					wasmInstr: "global.set",
					variables: globalVariables,
					position,
					wasmAfterVar: " ",
					command: {
						command: "cursorMove",
						title: "Cursor Move",
						arguments: [{ to: "left" }],
					}
				});
			}

			return [
				...globalVariables,
				...localVariables
			];
		}
		return undefined;
	}
}
const makeCompletionItem = (label: string, options?: Partial<vscode.CompletionItem>)=>{
	const item = new vscode.CompletionItem(label);
	for(const optionName in options) {
		// @ts-ignore
		let optionValue = options[optionName];
		if(optionValue) {
			// @ts-ignore
			item[optionName] = optionValue;
		}
	}
	return item;
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
	"TYPE.load": "Push a value from memory onto the stack at a specified offset.\n```wati\n($offset i32) ($align i32) (result TYPE)\n```",
	"TYPE.store": "Store a value into memory at a specified offset.\n```wati\n($offset i32) ($newValue TYPE)\n```",
	"TYPE.const": "Create a constant number of the specified type.",
	"TYPE.add": "Add the top two values on the stack and return the result.\n```wati\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.sub": "Subtract the top two values on the stack and return the result.\n```wati\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.mul": "Multiply the top two values on the stack and return the result.\n```wati\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.eq": "Check if parameter 1 and parameter 2 are equal. Returns true (`1i32`) if they are and false (`0i32`) if they aren't.\n```wati\n($param1 TYPE) ($param2 TYPE) (result i32)\n```",
	"TYPE.ne": "Check if parameter 1 and parameter 2 are not equal. Returns true (`1i32`) if they are not equal and false (`0i32`) if they are equal.\n```wati\n($param1 TYPE) ($param2 TYPE) (result i32)\n```",
	"i32.eqz": "Check if parameter 1 is equal to zero. Returns true (`1i32`) if it is equal to zero and false (`0i32`) if it is not.\n```wati\n(param TYPE) (result i32)\n```",
	"i64.eqz": "Check if parameter 1 is equal to zero. Returns true (`1i32`) if it is equal to zero and false (`0i32`) if it is not.\n```wati\n(param TYPE) (result i32)\n```",
	"@param": "Identifies the name and type of a parameter along with an optional comment. In the form \n```wati\n(; @param var_name {type} Comment here ;)\n```",
	"@result": "Identifies the return value of a function's type and optionally a comment about what it is. In the form \n```wati\n(; @result type Comment here ;)\n```",
	"i32": "The type for a 32 bit integer. Not inherently signed or unsigned, as it is interpreted as such by the operator.",
	"i64": "The type for a 64 bit integer. Not inherently signed or unsigned, as it is interpreted as such by the operator.",
	"f32": "The type for a 32 bit floating point number. Single precision as defined by IEEE 754-2019.",
	"f64": "The type for a 64 bit floating point number. Double precision as defined by IEEE 754-2019.",
	"module": "Declares a new WebAssembly module. Can only be at the top level of the file.\n\nA module may use an identifier to name the module for documentation purposes.\nE.g.\n```wat\n(module $name\n\t;; ...\n)\n```",
	"import": "Allows for calling of external functions within WebAssembly.\nOften corresponds to JavaScript or a WASI call.\n\nE.g.\n```wat\n(import \"MODULE_NAME\" \"ENTITY_NAME\" (func $identifier (param i32) (result i32)))\n```",
	"func": "Declares a new function, with an optional name.\n```wat\n(func $function_name (;...params;) (;result;)\n\t;; ...\n)\n```",
	"global": "Declares a new global variable, with a type, instruction, and an optional name.\n```wat\n(global $name TYPE ((;instr, eg;) i32.const 0)\n```",
	"data": "Allows for directly adding strings into a module's memory at a specified offset, similar to the .data section in traditional assembly.\n```wat\n(data (i32.const (;offset here;) \"Some string here\")\n```",
	"param": "Creates a parameter for a function with an optional name.\n```wat\n(param $name TYPE)\n```",
	"result": "Specifies the result/return value for a function.\nSpecifying more than one type is supported in most implementations, see the [archived multi-value proposal](https://github.com/WebAssembly/multi-value).\n```wat\n(result ...TYPE)\n```",
	"local": "Declares a local variable with an optional name.\n```wat\n(local $name TYPE)\n```",
	"local.get": "Gets the value of a local variable, specified by name or index.",
	"local.set": "Sets the value of a local variable, specified by name or index.",
	"local.tee": "Sets the value of a local variable, specified by name or index. Like `local.set` but also returns its argument.",
	"global.get": "Gets the value of a global variable, specified by name or index.",
	"global.set": "Sets the value of a global variable, specified by name or index. Only succeeds if the variable is mutable.",
	"drop": "Throw away the first value on the stack",
	"select": "Selects one of its first two operands based on whether its third operand is zero or not. It may include a value type determining the type of these operands.",
	"call": "Call a function specified by name or index.",
	"memory.size": "Returns the current size, in pages, of a memory.",
	"memory.grow": "Grows a memory by a given delta in page size and returns the previous size, or -1 if enough memory cannot be allocated."
	// "TYPE.": "",
}
const sharedAllIAllF: SharedCompletionItem[] = [
	{ label: "load", documentation: uniDocs["TYPE.load"] },
	{ label: "store", documentation: uniDocs["TYPE.store"] },
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
		makeCompletionItem("size", { documentation: uniDocs["memory.size"], kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("grow", { documentation: uniDocs["memory.grow"], kind: vscode.CompletionItemKind.Field }),
	],
	"local.": [
		makeCompletionItem("get", { documentation: uniDocs["local.get"], kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("set", { documentation: uniDocs["local.set"], kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("tee", { documentation: uniDocs["local.tee"], kind: vscode.CompletionItemKind.Field }),
	],
	"global.": [
		makeCompletionItem("get", { documentation: uniDocs["global.get"], kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("set", { documentation: uniDocs["global.set"], kind: vscode.CompletionItemKind.Field }),
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
	"@": [
		makeCompletionItem("param", {kind: vscode.CompletionItemKind.Text, documentation: new vscode.MarkdownString(uniDocs["@param"])}),
		makeCompletionItem("result", {kind: vscode.CompletionItemKind.Text, documentation: new vscode.MarkdownString(uniDocs["@result"])}),
	]
}

class WatiSyntaxCompletionProvider implements vscode.CompletionItemProvider {
	public static triggerCharacters = ["2", "4", "$"];
	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		completionContext: vscode.CompletionContext
	): vscode.CompletionItem[]|undefined {
		// disable if wat and not on in wat
		if(document.languageId === "wat" && !vscode.workspace.getConfiguration('wati').useIntellisenseInWatFiles) {
			return undefined;
		}

		const linePrefix = document.lineAt(position).text.substring(0, position.character);

		// match & convert number constants - e.g. 5i32, 5.11f64, 500_000_000i64
		const numberConstantMatch = linePrefix.match(/([\d|.|_]+)((?:i|f)(?:32|64))$/);
		if(numberConstantMatch) {
			const [fullMatch, number, type] = numberConstantMatch;
			const textToInsert = `(${type}.const ${number.replace(/_/g, "")})`;
			return [makeCompletionItem(fullMatch, {insertText: textToInsert, detail: "insert: "+textToInsert })];
		}
	}
}

// HOVER
const files: IFileVariables = {};
const getVariablesInFile = (document: vscode.TextDocument): VariablesInFile=>{
	const returned: VariablesInFile = {globals: {}, functions: {}}
	const text = document.getText();
	let globals = [...text.matchAll(getGlobals)];
	globals.forEach((match)=>{
		returned.globals[match[1]] = {
			name: match[1],
			isMutable: match[2] === "mut",
			type: match[3] as VariableType,
			initialValue: match[4],
		};
	});
	let functions = [...text.matchAll(getFunctions)];
	functions.forEach((match)=>{
		let name = match[1];
		const paramString = match[2];
		const returnType = match[3];
		const localString = match[4];

		if(!name) {
			// this can happen, so we rely on export name
			let exportName = match[0].match(getExport)?.[1];
			// if there isn't an export, we give up
			if(!exportName) return;

			name = "__WATI_EXPORTED__"+exportName;
		}

		let parameters: Variable[] = [];
		if (paramString) {
			const paramMatch = [...paramString.matchAll(getParamsOrLocals)];
			parameters = paramMatch.map(getNameType);
		}

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

		returned.functions[name] = {
			name,
			returnType: !returnType ? null : returnType as VariableType,
			parameters,
			locals,
			blocks: {}
		};
	});
	const lines = text.split(/^/gm);
	for(var i = 0; i < lines.length; i++) {
		const line = lines[i];
		const block = line.match(getBlock);
		if(!block) continue;
		const [_, blockType, blockLabel] = block;
		const funcNameOfBlock = getCurFunc(document, { line: i });
		if(!funcNameOfBlock) continue;
		const funcOfBlock = returned.functions[funcNameOfBlock];
		if(!funcOfBlock) continue;
		funcOfBlock.blocks[blockLabel] = {
			type: blockType,
			label: blockLabel,
			lineNum: i+1
		};
	}
	return returned;
}
const updateFiles = (document: vscode.TextDocument)=>{
	// if is wati or is wat and wat is enabled
	if(document.languageId === "wati" || (document.languageId === "wat" && vscode.workspace.getConfiguration('wati').useIntellisenseInWatFiles)) {
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
const getGlobals = /\(global (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (?:\((mut) *)*(i32|i64|f32|f64)(?:\s*\(([^)]+)\))?/g;
const getParamsOrLocals = /(?: *\((?:(?:param +|local +|l)(?:(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) +)*(i32|i64|f32|f64)|(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (i32|i64|f32|f64))| (i32|i64|f32|f64))/g;
const getFunctions = /\((?:\s*func)(?:\s*(?:\(.*?\)\s*)*?|\s*)(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)?(?: |\s*\(export[^)]+?\)(?:\s+;;.+)*)*((?:\s*\((?:param | *\$)[^)]+\)\s*(?:;;.+)*)+)*(?:\s*\(result (i32|i64|f32|f64)\)\s*(?:;;.+)*)*\s*((?:\s*\((?:local\s+|l)(?:\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*\s+)?(?:i32|i64|f32|f64)\)\s*(?:;;.+)?)+)*/g;
const getFuncNameFromLine = /\((?:\s*func)(?:\s*(?:\(.*?\)\s*)*?|\s*)(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)/;
const isLineAFunc = /\(func/;
const getNameAndParamOfCall = /call (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)(\((?:[^,\n]*(?:,|\)))*)/;
const getExport = /\(\s*export\s*"([^"]+)"\)/;
const getBlock = /(?:\s+|^)(block|loop|if)\s*(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)/;

const getCurFunc = (document: vscode.TextDocument, {line: curLineNum}: {line: number})=>{
	// this is a hacky solution but since it is only used for local vars it works fine
	let curFunc: string | undefined;
	while (curLineNum > 0) {
		const curLine = document.lineAt(curLineNum).text;
		if (isLineAFunc.test(curLine)) {
			// line is a func
			curFunc = curLine.match(getFuncNameFromLine)?.[1];
			if(!curFunc) {
				// try to use export
				const exportName = curLine.match(getExport)?.[1];
				if(exportName) {
					curFunc = "__WATI_EXPORTED__"+exportName;
				}
			}
			break;
		}
		curLineNum -= 1;
	}
	return curFunc;
}

const getStringFromFuncRef = (func: FunctionDescriptor)=>{
	return `(func ${func.name}${func.parameters.length === 0 ? "" : " "}${func.parameters.map((v)=>`(${v.name ? v.name+" " : ""}${v.type})`).join(" ")})\n(result${func.returnType ? " "+func.returnType : ""})`
}

class WatiHoverProvider implements vscode.HoverProvider {
	public provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
		): vscode.Hover|null
	{
		// disable if wat and not on in wat
		if(document.languageId === "wat" && !vscode.workspace.getConfiguration('wati').useIntellisenseInWatFiles) {
			return null;
		}
		updateFiles(document);

		const word = document.getText(document.getWordRangeAtPosition(position, /[^ ();,]+/)).trim();
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
			// it is a global variable, local variable, function or block label

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
				if(valAtGlobal.initialValue) {
					out.appendCodeblock("  = "+valAtGlobal.initialValue, "wati")
				}
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
			if(curFunc) { // must be in a function for a param
				const paramRef = file.functions[curFunc].parameters;
				const wordIndex = paramRef.findIndex(v=>v.name === word);
				const valAtParam = wordIndex !== -1 ? paramRef[wordIndex] : undefined;
				if(valAtParam) {
					const out = new vscode.MarkdownString();
					out.appendCodeblock(`(param ${valAtParam.name} ${valAtParam.type})`, 'wati');
					return new vscode.Hover(out);
				}
			}

			// BLOCK LABEL
			if(curFunc) {
				const block = file.functions[curFunc].blocks[word];
				if(block) {
					const out = new vscode.MarkdownString();
					out.appendCodeblock(`${block.type} ${block.label} ;; on line ${block.lineNum}`, 'wati');
					return new vscode.Hover(out);
				}
			}
			
			// if nothing else has matched, just be unknown
			// ? Show red underline?
			return new vscode.Hover(`\tunknown`);
		} else if(word.startsWith("l$")) {
			// local var definition
			const realVar = word.slice(1);
			if(curFunc) { // must be in a function for a local var
				const valAtLocal = file.functions[curFunc].locals[realVar];
				if(valAtLocal) {
					const out = new vscode.MarkdownString();
					out.appendCodeblock(`(local ${valAtLocal.name} ${valAtLocal.type})`, 'wati');
					return new vscode.Hover(out);
				}
			}
			return new vscode.Hover(`\tunknown`);
		} else {
			// might be an instruction or just a random word
			const capturedWord = word.match(/(i32|i64|f32|f64)\.(\S+)/);
			if(capturedWord) {
				// is an instruction
				let doc = uniDocs["TYPE."+capturedWord[2]]; // check if there is a global type
				doc = !!doc ? doc : uniDocs[`${capturedWord[1]}.${capturedWord[2]}`]; // if there isn't, check if there is a more specific type
				return new vscode.Hover(`${!!doc ? doc.replace(/TYPE/g, capturedWord[1]) : "No documentation available."}`);
			} else if(uniDocs[word]) {
				return new vscode.Hover(uniDocs[word]);
			}
		}
		return null;
		// DEBUG: return new vscode.Hover(`${word}\n\nline: ${position.line}\ncharacter: ${position.character}`);
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
	blocks: BlockByName
}
interface VariableByName {
	// includes the $
	[key: string]: Variable
}
interface Variable {
	type: VariableType
	isMutable?: boolean
	name: string|undefined // includes the $, is undefined if no name (just indexed)
	initialValue?: string
}
type VariableType = "i32"|"i64"|"f32"|"f64"|"unknown"|null;
interface Block {
	type: string
	label: string // only blocks with labels are stored
	lineNum: number
}
interface BlockByName {
	// includes the $
	[key: string]: Block
}