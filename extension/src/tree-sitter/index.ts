import Parser from "web-tree-sitter";
import { Idents } from "./idents";

let languageWasm: Parser.Language;
let parser: Parser;
Parser.init()
  .then(() => Parser.Language.load("./tree-sitter-wat.wasm"))
  .then(wasm => {
    languageWasm = wasm;
    parser = new Parser();
    parser.setLanguage(languageWasm);
  });

export const fileTreeSitterMap = new Map<string, { idents: Idents, tree: Parser.Tree }>();

export const getLanguage = () => languageWasm;
export const getParser = () => parser;
export * from './idents';