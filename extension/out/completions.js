"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completionItems = exports.instructionDocs = exports.makeCompletionItem = void 0;
const vscode = require("vscode");
const makeCompletionItem = (label, options) => {
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
exports.makeCompletionItem = makeCompletionItem;
const instrsToCompletionItems = (instrs, type) => {
    return instrs.map((instr) => {
        var _a;
        const documentation = (_a = exports.instructionDocs[`${type}.${instr}`]) !== null && _a !== void 0 ? _a : exports.instructionDocs[`TYPE.${instr}`];
        return exports.makeCompletionItem(instr, {
            documentation: documentation ? new vscode.MarkdownString(documentation.replace(/TYPE/g, type)) : undefined,
            kind: vscode.CompletionItemKind.Field,
        });
    });
};
// documentation shared between hovers and completion
// docs starting with "TYPE." will match any type (e.g TYPE.load will show for i32.load, i64.load, f32.load, and f64.load)
exports.instructionDocs = {
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
    i32: "The type for a 32 bit integer. Not inherently signed or unsigned, as it is interpreted as such by the operator.",
    i64: "The type for a 64 bit integer. Not inherently signed or unsigned, as it is interpreted as such by the operator.",
    f32: "The type for a 32 bit floating point number. Single precision as defined by IEEE 754-2019.",
    f64: "The type for a 64 bit floating point number. Double precision as defined by IEEE 754-2019.",
    module: "Declares a new WebAssembly module. Can only be at the top level of the file.\n\nA module may use an identifier to name the module for documentation purposes.\nE.g.\n```wat\n(module $name\n\t;; ...\n)\n```",
    import: 'Allows for calling of external functions within WebAssembly.\nOften corresponds to JavaScript or a WASI call.\n\nE.g.\n```wat\n(import "MODULE_NAME" "ENTITY_NAME" (func $identifier (param i32) (result i32)))\n```',
    export: [
        "Export a value for use in the host environment. Syntax:",
        "```wat\n(export \"exportName\" (; some value ;))\n```",
        "Examples:",
        "```wat",
        "(export \"mem\" (memory 0))",
        "(export \"getNum\" (func $get_num))",
        "(func $double_num (export \"doubleNum\") (param i32) ;; inline-export",
        "\t;; ...",
        ")",
        "\n```"
    ].join('\n'),
    func: "Declares a new function, with an optional name.\n```wat\n(func $function_name (;...params;) (;result;)\n\t;; ...\n)\n```",
    global: "Declares a new global variable, with a type, instruction, and an optional name.\n```wat\n(global $name TYPE ((;instr, eg;) i32.const 0)\n```",
    table: [
        "Declares a new table. Uses the syntax:",
        "```wat\n(table $table_name SIZE [MAX_SIZE] REF_TYPE)\n```",
        "Examples:",
        "```wat\n(table $funcs_table 2 funcref)\n(table $externs_table 2 10 externref)\n```\n",
        "Size can be omitted when inlining an `elem` declaration:",
        "```wat\n(table $funcs_table funcref (elem $id1 $id2 $id3))\n```",
    ].join('\n'),
    elem: [
        "Declares the elements of a table. Uses the syntax:",
        "```wat\n(elem $table_name (i32.const INITIAL_INDEX) $id1 $id2 $id3)\n```",
        "Example:",
        "```wat\n(table $funcs_table 2 funcref)\n(elem $funcs_table (i32.const 0) $f1 $f2)\n```",
        "It can optionally include a type:",
        "```wat\n(; ...some table... ;)\n(elem $funcs_table (i32.const 0) func $f1 $f2)\n```"
    ].join('\n'),
    "table.set": [
        "Sets the value of a table at an index. Syntax:",
        "```wat\n(table.set $table_id INDEX NEW_VALUE)\n```",
        "Example:",
        "```wat\n(table.set $funcs_table (i32.const 2) (local.get $func_ref))\n```",
    ].join('\n'),
    "table.get": [
        "Gets the value of a table at an index. Syntax:",
        "```wat\n(table.get $table_id INDEX)\n```",
        "Example:",
        "```wat\n(table.get $funcs_table (i32.const 2))\n```",
    ].join('\n'),
    call_indirect: [
        "Call a function retrieved from a table. A specific type must be specified. Syntax:",
        "```wat\n(call_indirect $table_id (type $type_id) TABLE_INDEX ...FUNC_ARGS)\n```",
        "Example:",
        "```wat",
        "(type $f64_to_i32 (param f64) (result i32))",
        "(table $funcs_table funcref (elem $func1 $func2))",
        "(; in some function: ;)",
        "(call_indirect $funcs_table (type $f64_to_i32) (i32.const 0) (f64.const 5.4))",
        "```",
    ].join('\n'),
    funcref: "The type for a reference to a function or null",
    externref: "The type for any external reference or null",
    extern: "The type for an external reference",
    "ref.func": "Gets a reference for a function. Syntax:\n```wat\n(ref.func $func_id)\n```",
    "ref.null": "Gets a null reference for a function or extern. Syntax:\n```wat\n(ref.null func) ;; empty ref for func type\n(ref.null extern) ;; empty ref for extern type\n```",
    "ref.is_null": "Checks if a reference is empty. Syntax:\n```wat\n(ref.null $ref_id)\n```",
    data: 'Allows for directly adding strings into a module\'s memory at a specified offset, similar to the .data section in traditional assembly.\n```wat\n(data (i32.const (;offset here;)) "Some string here")\n```',
    memory: "Requests a block of memory. Syntax:\n```wat\n(memory MIN_SIZE [MAX_SIZE])\n```",
    param: "Creates a parameter for a function with an optional name.\n```wat\n(param $name TYPE)\n```",
    result: "Specifies the result/return value for a function.\nSpecifying more than one type is supported in most implementations, see the [archived multi-value proposal](https://github.com/WebAssembly/multi-value).\n```wat\n(result ...TYPE)\n```",
    local: "Declares a local variable with an optional name.\n```wat\n(local $name TYPE)\n```",
    "local.get": "Gets the value of a local variable, specified by name or index.",
    "local.set": "Sets the value of a local variable, specified by name or index.",
    "local.tee": "Sets the value of a local variable, specified by name or index. Like `local.set` but also returns its argument.",
    "global.get": "Gets the value of a global variable, specified by name or index.",
    "global.set": "Sets the value of a global variable, specified by name or index. Only succeeds if the variable is mutable.",
    drop: "Throw away the first value on the stack",
    select: "Selects one of its first two operands based on whether its third operand is zero or not. It may include a value type determining the type of these operands.",
    call: "Call a function specified by name or index.",
    "memory.size": "Returns the current size, in pages, of a memory.",
    "memory.grow": "Grows a memory by a given delta in page size and returns the previous size, or -1 if enough memory cannot be allocated.",
    loop: [
        "Define a block with a label at the **start**. Syntax:",
        "```wat\n(loop $loop_id \n\t;; ...\n)\n```"
    ].join('\n'),
    block: [
        "Define a block with a label at the **end**. Syntax:",
        "```wat\n(block $block_id \n\t;; ...\n)\n```"
    ].join('\n'),
    if: [
        "Execute code blocks depending on whether a stack value is 0. Syntax:",
        "```wat",
        "(if (; add type here if block returns a value ;)",
        "  (; some code that returns an i32 ;)",
        "  (then (; code to execute if non-zero ;))",
        "  (else (; code to execute if zero ;))",
        ")",
        "```",
        "If not using the folded form, it can be written like this:",
        "```wat",
        "(; conditional value placed on stack ;)",
        "if",
        "  ;; code to execute if non-zero",
        "else",
        "  ;; code to execute if zero",
        "end",
        "```",
    ].join('\n'),
    then: "Defines a block to execute if conditional is non-zero.",
    else: "Defines a block to execute if conditional is zero.",
    br: "Branch instruction. Jumps to $label_id. Syntax: \n```wat\n(br $label_id)\n```",
    br_if: "Conditional branch instruction. Jumps to $label_id if conditional value is non-zero. Syntax: \n```wat\n(br_if $label_id (; conditional value ;))\n```",
    br_table: [
        "Table branch instruction. Jumps to one of the $label_ids based off of a provided index. Syntax:",
        "```wat",
        "(br_table $label_id1 $label_id2 $label_id3 (; index ;))",
        "```",
    ].join('\n'),
    unreachable: "Declares an unreachable section of code.",
    return: "Jumps to the end of the current function.",
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
exports.completionItems = {
    "i32.": [...instrsToCompletionItems(intAndFloatInstrs, "i32"), ...instrsToCompletionItems(intInstrs, "i32")],
    "i64.": [
        ...instrsToCompletionItems(intAndFloatInstrs, "i64"),
        ...instrsToCompletionItems(intInstrs, "i64"),
        exports.makeCompletionItem("load32_s", { kind: vscode.CompletionItemKind.Field }),
        exports.makeCompletionItem("load32_u", { kind: vscode.CompletionItemKind.Field }),
        exports.makeCompletionItem("store32", { kind: vscode.CompletionItemKind.Field }),
    ],
    "f32.": [...instrsToCompletionItems(intAndFloatInstrs, "f32"), ...instrsToCompletionItems(floatInstrs, "f32")],
    "f64.": [...instrsToCompletionItems(intAndFloatInstrs, "f64"), ...instrsToCompletionItems(floatInstrs, "f64")],
    "memory.": [
        exports.makeCompletionItem("size", {
            documentation: exports.instructionDocs["memory.size"],
            kind: vscode.CompletionItemKind.Field,
        }),
        exports.makeCompletionItem("grow", {
            documentation: exports.instructionDocs["memory.grow"],
            kind: vscode.CompletionItemKind.Field,
        }),
    ],
    "local.": [
        exports.makeCompletionItem("get", {
            documentation: exports.instructionDocs["local.get"],
            kind: vscode.CompletionItemKind.Field,
        }),
        exports.makeCompletionItem("set", {
            documentation: exports.instructionDocs["local.set"],
            kind: vscode.CompletionItemKind.Field,
        }),
        exports.makeCompletionItem("tee", {
            documentation: exports.instructionDocs["local.tee"],
            kind: vscode.CompletionItemKind.Field,
        }),
    ],
    "global.": [
        exports.makeCompletionItem("get", {
            documentation: exports.instructionDocs["global.get"],
            kind: vscode.CompletionItemKind.Field,
        }),
        exports.makeCompletionItem("set", {
            documentation: exports.instructionDocs["global.set"],
            kind: vscode.CompletionItemKind.Field,
        }),
    ],
    i: [
        exports.makeCompletionItem("i32", {
            kind: vscode.CompletionItemKind.Variable,
            commitCharacters: ["."],
        }),
        exports.makeCompletionItem("i64", {
            kind: vscode.CompletionItemKind.Variable,
            commitCharacters: ["."],
        }),
        exports.makeCompletionItem("if", { kind: vscode.CompletionItemKind.Variable }),
    ],
    f: [
        exports.makeCompletionItem("f32", {
            kind: vscode.CompletionItemKind.Variable,
            commitCharacters: ["."],
        }),
        exports.makeCompletionItem("f64", {
            kind: vscode.CompletionItemKind.Variable,
            commitCharacters: ["."],
        }),
    ],
    m: [
        exports.makeCompletionItem("memory", {
            kind: vscode.CompletionItemKind.Variable,
            commitCharacters: ["."],
        }),
    ],
    g: [exports.makeCompletionItem("global", { kind: vscode.CompletionItemKind.Variable })],
    l: [
        exports.makeCompletionItem("loop", { kind: vscode.CompletionItemKind.Variable }),
        exports.makeCompletionItem("local", { kind: vscode.CompletionItemKind.Variable }),
    ],
    b: [
        exports.makeCompletionItem("block", { kind: vscode.CompletionItemKind.Variable }),
        exports.makeCompletionItem("br", { kind: vscode.CompletionItemKind.Variable }),
        exports.makeCompletionItem("br_if", { kind: vscode.CompletionItemKind.Variable }),
    ],
    e: [
        exports.makeCompletionItem("else", { kind: vscode.CompletionItemKind.Variable }),
        exports.makeCompletionItem("end", { kind: vscode.CompletionItemKind.Variable }),
    ],
    u: [exports.makeCompletionItem("unreachable", { kind: vscode.CompletionItemKind.Variable })],
    n: [exports.makeCompletionItem("nop", { kind: vscode.CompletionItemKind.Variable })],
    r: [exports.makeCompletionItem("return", { kind: vscode.CompletionItemKind.Variable })],
    c: [
        exports.makeCompletionItem("call", { kind: vscode.CompletionItemKind.Variable }),
        exports.makeCompletionItem("call_indirect", { kind: vscode.CompletionItemKind.Variable }),
    ],
    d: [exports.makeCompletionItem("drop", { kind: vscode.CompletionItemKind.Variable })],
    s: [
        exports.makeCompletionItem("select", { kind: vscode.CompletionItemKind.Variable }),
        exports.makeCompletionItem("stack", { kind: vscode.CompletionItemKind.Variable }),
    ],
    "@": [
        exports.makeCompletionItem("param", {
            kind: vscode.CompletionItemKind.Text,
            documentation: new vscode.MarkdownString(exports.instructionDocs["@param"]),
        }),
        exports.makeCompletionItem("result", {
            kind: vscode.CompletionItemKind.Text,
            documentation: new vscode.MarkdownString(exports.instructionDocs["@result"]),
        }),
    ],
};
//# sourceMappingURL=completions.js.map