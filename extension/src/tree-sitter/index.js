const Parser = require("web-tree-sitter");
const path = require("path");
const HoverFuncs = require("./hover.js");

/** @typedef {import('./types.d.ts').Idents} Idents */

/** @type {Parser.Language | void} */
let languageWasm;

/** @type {Parser | void} */
let parser;

Parser.init()
	.then(() => Parser.Language.load(path.join(__dirname, "tree-sitter-wat.wasm")))
	.then((wasm) => {
		languageWasm = wasm;
		parser = new Parser();
		parser.setLanguage(languageWasm);
	});

/** @type {Map<string, { tree: Parser.Tree }>} */
const fileTreeSitterMap = new Map();

const getParser = () => parser;

/**
 * TODO: add for idents:
 *  - br, br_if
 *  - call_indirect (table)
 *  - type
 *  - allow index idents
 */

const queries = /** @type {const} */ ({
	type: `(module_field_type
      (identifier) @ident 
      (type_field 
        (func_type (func_type_params) @params)*
        (func_type (func_type_results) @result)*
      )
    )`,

	table: `(module_field_table identifier: (identifier) @ident 
      (table_fields_type (table_type
        (limits) @limits
        (ref_type) @ref_type
      )) 
    )`,
});

/** @param {Parser.SyntaxNode} node */
function getHoverData(node) {
	if (!languageWasm) throw Error("not initialized yet!");

	if (node.type !== 'identifier' || !node.parent) return;

	const parent = node.parent;

	if (parent.type === "module_field_func") {
		return HoverFuncs.getFunctionHoverString(languageWasm, parent);
	}

	if (parent?.parent?.type === "instr_plain") {
		const surroundingText = parent.parent.text;
		if (surroundingText.startsWith('global.')) {
			return HoverFuncs.getGlobalHoverString(languageWasm, node);
		}
		if (surroundingText.startsWith('local.')) {
			return HoverFuncs.getLocalHoverString(languageWasm, node);
		}
		if (surroundingText.startsWith('call')) {
			return HoverFuncs.getCallHoverString(languageWasm, node);
		}
	}
}

module.exports = {
	fileTreeSitterMap,
	getHoverData,
	getParser,
};
