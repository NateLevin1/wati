const Parser = require("web-tree-sitter");

/** @type {Parser.Language} */
let languageWasm;

/** @type {Parser} */
let parser;

Parser.init()
  .then(() => Parser.Language.load("./tree-sitter-wat.wasm"))
  .then(wasm => {
    languageWasm = wasm;
    parser = new Parser();
    parser.setLanguage(languageWasm);
  });

/** @type {Map<string, { idents: import('./types.d.ts').Idents, tree: Parser.Tree }>} */
const fileTreeSitterMap = new Map();

const getLanguage = () => languageWasm;
const getParser = () => parser;

module.exports = { fileTreeSitterMap, getLanguage, getParser, ...require('./idents.js') };