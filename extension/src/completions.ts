import * as vscode from "vscode";

export const makeCompletionItem = (label: string, options?: Partial<vscode.CompletionItem>) => {
	const item = new vscode.CompletionItem(label);
	for (const optionName in options) {
		// @ts-ignore
		let optionValue = options[optionName];
		if (optionValue) {
			// @ts-ignore
			item[optionName] = optionValue;
		}
	}
	return item;
};
const instrsToCompletionItems = (instrs: string[], type: "i32" | "i64" | "f32" | "f64") => {
	return instrs.map((instr) => {
		const documentation: string | undefined = instructionDocs[`${type}.${instr}`] ?? instructionDocs[`TYPE.${instr}`];
		return makeCompletionItem(instr, {
			documentation: documentation ? new vscode.MarkdownString(documentation.replace(/TYPE/g, type)) : undefined,
			kind: vscode.CompletionItemKind.Field,
		});
	});
};

// documentation shared between hovers and completion
// docs starting with "TYPE." will match any type (e.g TYPE.load will show for i32.load, i64.load, f32.load, and f64.load)
export const instructionDocs: { [instruction: string]: string } = {
	"TYPE.load":
		"Push a value from memory onto the stack at a specified offset.\n```wati\n($offset i32) ($align i32) (result TYPE)\n```",
	"TYPE.store": "Store a value into memory at a specified offset.\n```wati\n($offset i32) ($newValue TYPE)\n```",
	"TYPE.const": "Create a constant number of the specified type.",
	"TYPE.add": "Add the top two values on the stack and return the result.\n```wati\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.sub":
		"Subtract the top two values on the stack and return the result.\n```wati\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.mul":
		"Multiply the top two values on the stack and return the result.\n```wati\n($num1 TYPE) ($num2 TYPE) (result TYPE)\n```",
	"TYPE.eq":
		"Check if parameter 1 and parameter 2 are equal. Returns true (`1i32`) if they are and false (`0i32`) if they aren't.\n```wati\n($param1 TYPE) ($param2 TYPE) (result i32)\n```",
	"TYPE.ne":
		"Check if parameter 1 and parameter 2 are not equal. Returns true (`1i32`) if they are not equal and false (`0i32`) if they are equal.\n```wati\n($param1 TYPE) ($param2 TYPE) (result i32)\n```",
	"i32.eqz":
		"Check if parameter 1 is equal to zero. Returns true (`1i32`) if it is equal to zero and false (`0i32`) if it is not.\n```wati\n(param TYPE) (result i32)\n```",
	"i64.eqz":
		"Check if parameter 1 is equal to zero. Returns true (`1i32`) if it is equal to zero and false (`0i32`) if it is not.\n```wati\n(param TYPE) (result i32)\n```",
	"@param":
		"Identifies the name and type of a parameter along with an optional comment. In the form \n```wati\n(; @param var_name {type} Comment here ;)\n```",
	"@result":
		"Identifies the return value of a function's type and optionally a comment about what it is. In the form \n```wati\n(; @result type Comment here ;)\n```",
	i32: "The type for a 32 bit integer. Not inherently signed or unsigned, as it is interpreted as such by the operator.",
	i64: "The type for a 64 bit integer. Not inherently signed or unsigned, as it is interpreted as such by the operator.",
	f32: "The type for a 32 bit floating point number. Single precision as defined by IEEE 754-2019.",
	f64: "The type for a 64 bit floating point number. Double precision as defined by IEEE 754-2019.",
	module:
		"Declares a new WebAssembly module. Can only be at the top level of the file.\n\nA module may use an identifier to name the module for documentation purposes.\nE.g.\n```wat\n(module $name\n\t;; ...\n)\n```",
	import:
		'Allows for calling of external functions within WebAssembly.\nOften corresponds to JavaScript or a WASI call.\n\nE.g.\n```wat\n(import "MODULE_NAME" "ENTITY_NAME" (func $identifier (param i32) (result i32)))\n```',
	func: "Declares a new function, with an optional name.\n```wat\n(func $function_name (;...params;) (;result;)\n\t;; ...\n)\n```",
	global:
		"Declares a new global variable, with a type, instruction, and an optional name.\n```wat\n(global $name TYPE ((;instr, eg;) i32.const 0)\n```",
	data: 'Allows for directly adding strings into a module\'s memory at a specified offset, similar to the .data section in traditional assembly.\n```wat\n(data (i32.const (;offset here;) "Some string here")\n```',
	param: "Creates a parameter for a function with an optional name.\n```wat\n(param $name TYPE)\n```",
	result:
		"Specifies the result/return value for a function.\nSpecifying more than one type is supported in most implementations, see the [archived multi-value proposal](https://github.com/WebAssembly/multi-value).\n```wat\n(result ...TYPE)\n```",
	local: "Declares a local variable with an optional name.\n```wat\n(local $name TYPE)\n```",
	"local.get": "Gets the value of a local variable, specified by name or index.",
	"local.set": "Sets the value of a local variable, specified by name or index.",
	"local.tee": "Sets the value of a local variable, specified by name or index. Like `local.set` but also returns its argument.",
	"global.get": "Gets the value of a global variable, specified by name or index.",
	"global.set": "Sets the value of a global variable, specified by name or index. Only succeeds if the variable is mutable.",
	drop: "Throw away the first value on the stack",
	select:
		"Selects one of its first two operands based on whether its third operand is zero or not. It may include a value type determining the type of these operands.",
	call: "Call a function specified by name or index.",
	"memory.size": "Returns the current size, in pages, of a memory.",
	"memory.grow":
		"Grows a memory by a given delta in page size and returns the previous size, or -1 if enough memory cannot be allocated.",
	// "TYPE.": "",
};

const intAndFloatInstrs = ["load", "store", "const", "add", "sub", "mul", "eq", "ne"];
const intInstrs = [
	"load8_s",
	"load8_u",
	"load16_s",
	"load16_u",
	"store8",
	"store16",
	"clz",
	"ctz",
	"popcnt",
	"div_s",
	"div_u",
	"rem_s",
	"rem_u",
	"and",
	"or",
	"xor",
	"shl",
	"shr_s",
	"shr_u",
	"rotl",
	"rotr",
	"eqz",
	"lt_s",
	"lt_u",
	"gt_s",
	"gt_u",
	"le_s",
	"le_u",
	"ge_s",
	"ge_u",
];
const floatInstrs = [
	"abs",
	"neg",
	"ceil",
	"floor",
	"trunc",
	"nearest",
	"sqrt",
	"div",
	"min",
	"max",
	"copysign",
	"lt",
	"gt",
	"le",
	"ge",
];

export const completionItems: { [key: string]: vscode.CompletionItem[] } = {
	"i32.": [...instrsToCompletionItems(intAndFloatInstrs, "i32"), ...instrsToCompletionItems(intInstrs, "i32")],
	"i64.": [
		...instrsToCompletionItems(intAndFloatInstrs, "i64"),
		...instrsToCompletionItems(intInstrs, "i64"),
		makeCompletionItem("load32_s", { kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("load32_u", { kind: vscode.CompletionItemKind.Field }),
		makeCompletionItem("store32", { kind: vscode.CompletionItemKind.Field }),
	],
	"f32.": [...instrsToCompletionItems(intAndFloatInstrs, "f32"), ...instrsToCompletionItems(floatInstrs, "f32")],
	"f64.": [...instrsToCompletionItems(intAndFloatInstrs, "f64"), ...instrsToCompletionItems(floatInstrs, "f64")],
	"memory.": [
		makeCompletionItem("size", {
			documentation: instructionDocs["memory.size"],
			kind: vscode.CompletionItemKind.Field,
		}),
		makeCompletionItem("grow", {
			documentation: instructionDocs["memory.grow"],
			kind: vscode.CompletionItemKind.Field,
		}),
	],
	"local.": [
		makeCompletionItem("get", {
			documentation: instructionDocs["local.get"],
			kind: vscode.CompletionItemKind.Field,
		}),
		makeCompletionItem("set", {
			documentation: instructionDocs["local.set"],
			kind: vscode.CompletionItemKind.Field,
		}),
		makeCompletionItem("tee", {
			documentation: instructionDocs["local.tee"],
			kind: vscode.CompletionItemKind.Field,
		}),
	],
	"global.": [
		makeCompletionItem("get", {
			documentation: instructionDocs["global.get"],
			kind: vscode.CompletionItemKind.Field,
		}),
		makeCompletionItem("set", {
			documentation: instructionDocs["global.set"],
			kind: vscode.CompletionItemKind.Field,
		}),
	],
	i: [
		makeCompletionItem("i32", {
			kind: vscode.CompletionItemKind.Variable,
			commitCharacters: ["."],
		}),
		makeCompletionItem("i64", {
			kind: vscode.CompletionItemKind.Variable,
			commitCharacters: ["."],
		}),
		makeCompletionItem("if", { kind: vscode.CompletionItemKind.Variable }),
	],
	f: [
		makeCompletionItem("f32", {
			kind: vscode.CompletionItemKind.Variable,
			commitCharacters: ["."],
		}),
		makeCompletionItem("f64", {
			kind: vscode.CompletionItemKind.Variable,
			commitCharacters: ["."],
		}),
	],
	m: [
		makeCompletionItem("memory", {
			kind: vscode.CompletionItemKind.Variable,
			commitCharacters: ["."],
		}),
	],
	g: [makeCompletionItem("global", { kind: vscode.CompletionItemKind.Variable })],
	l: [
		makeCompletionItem("loop", { kind: vscode.CompletionItemKind.Variable }),
		makeCompletionItem("local", { kind: vscode.CompletionItemKind.Variable }),
	],
	b: [
		makeCompletionItem("block", { kind: vscode.CompletionItemKind.Variable }),
		makeCompletionItem("br", { kind: vscode.CompletionItemKind.Variable }),
		makeCompletionItem("br_if", { kind: vscode.CompletionItemKind.Variable }),
	],
	e: [
		makeCompletionItem("else", { kind: vscode.CompletionItemKind.Variable }),
		makeCompletionItem("end", { kind: vscode.CompletionItemKind.Variable }),
	],
	u: [makeCompletionItem("unreachable", { kind: vscode.CompletionItemKind.Variable })],
	n: [makeCompletionItem("nop", { kind: vscode.CompletionItemKind.Variable })],
	r: [makeCompletionItem("return", { kind: vscode.CompletionItemKind.Variable })],
	c: [
		makeCompletionItem("call", { kind: vscode.CompletionItemKind.Variable }),
		makeCompletionItem("call_indirect", { kind: vscode.CompletionItemKind.Variable }),
	],
	d: [makeCompletionItem("drop", { kind: vscode.CompletionItemKind.Variable })],
	s: [
		makeCompletionItem("select", { kind: vscode.CompletionItemKind.Variable }),
		makeCompletionItem("stack", { kind: vscode.CompletionItemKind.Variable }),
	],
	"@": [
		makeCompletionItem("param", {
			kind: vscode.CompletionItemKind.Text,
			documentation: new vscode.MarkdownString(instructionDocs["@param"]),
		}),
		makeCompletionItem("result", {
			kind: vscode.CompletionItemKind.Text,
			documentation: new vscode.MarkdownString(instructionDocs["@result"]),
		}),
	],
};
