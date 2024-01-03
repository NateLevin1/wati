const Parser = require("web-tree-sitter");
const path = require("path");
const getHoverPopover = require("./hover/index.js");

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
 *  - allow index idents
 */

/** @param {Parser.SyntaxNode} node */
function getHoverData(node) {
	if (!languageWasm) throw Error("not initialized yet!");

	return getHoverPopover(languageWasm, node);
}

module.exports = {
	fileTreeSitterMap,
	getHoverData,
	getParser,
};
