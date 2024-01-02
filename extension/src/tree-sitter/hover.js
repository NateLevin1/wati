const Parser = require("web-tree-sitter");
const vscode = require("vscode");

/**
 * @param {Parser.Language} language
 * @param {string} queryStr
 * @param {Parser.SyntaxNode} node
 * */
function queryWithErr(language, queryStr, node) {
	try {
		const query = language.query(queryStr);
		return query.matches(node);
	} catch (e) {
		console.log(e);
		throw e;
	}
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {string} type
 * */
function getParentNode(node, type) {
	let curNode = node;
	while (curNode?.parent) {
		curNode = curNode.parent;
		if (curNode.type === type) return curNode;
	}
}

const functionHoverQuery = `(module_field_func identifier: (identifier)? @ident
  (func_type_params
    [
      (func_type_params_one
        (identifier) @params_ident  
        (value_type) @params_type
      )
      (func_type_params_many
        (value_type)+ @params_type
      ) 
    ]
  )*
  (func_type_results (value_type) @result_type)? 
)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node
 * @returns {vscode.Hover}
 * */
function getFunctionHoverString(language, node) {
	const [{ captures }] = queryWithErr(language, functionHoverQuery, node);

	const name = captures.find(({ name }) => name === "ident")?.node.text;
	const params = captures.filter(({ name }) => name === "params_type").map(({ node }) => node.text);

	let hoverCode = `(func ${name} (param ${params.join(" ")})`;
	const result = captures.find(({ name }) => name === "result_type")?.node.text;
	if (result) hoverCode += ` (result ${result})`;
	hoverCode += ")";

	const out = new vscode.MarkdownString();
	out.appendCodeblock(hoverCode, "wati");
	return new vscode.Hover(out);
}

const globalHoverQuery = `(module_field_global identifier: (identifier)? @ident (global_type) @global_type)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node
 * @returns {vscode.Hover}
 * */
function getGlobalHoverString(language, node) {
	const globalIdent = node.text;

	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) return new vscode.Hover("Could not resolve module");

	const matches = queryWithErr(language, globalHoverQuery, moduleNode);
	for (const { captures } of matches) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text;
		if (ident !== globalIdent) continue;

		const type = captures.find(({ name }) => name === "global_type")?.node.text;

		const hoverCode = `(global ${globalIdent} ${type})`;

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}
	return new vscode.Hover("No such global variable in scope");
}

const localHoverQuery = `(module_field_func identifier: (identifier)?
  (func_type_params
    [
      (func_type_params_one
        (identifier) @params_ident  
        (value_type) @params_type
      )
      (func_type_params_many
        (value_type)+ @params_type
      )
    ]  
  )*
  (func_type_results (value_type) @result_type)? 
  (func_locals
    [
      (func_locals_one
        (identifier) @locals_ident  
        (value_type) @locals_type
      )
      (func_locals_many
        (value_type)+ @locals_type
      )
    ] 
  )*
)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node
 * @returns {vscode.Hover}
 * */
function getLocalHoverString(language, node) {
	const localIdent = node.text;

	const moduleNode = getParentNode(node, "module_field_func");
	if (!moduleNode) return new vscode.Hover("Could not resolve current function");

	const params = [];
	const localTypes = [];
  /** @type {Map<string, number>} */
	const localIdentMap = new Map();

	const [{ captures }] = queryWithErr(language, localHoverQuery, moduleNode);
	for (const { name, node } of captures) {
		if (name === "params_type" || name === "locals_type") {
			const type = node.text;
			if (name === "params_type") params.push(type);
			localTypes.push(type);
		} else if (name === "params_ident" || name === "locals_ident") {
			const ident = node.text;
			const index = localTypes.length;
			localIdentMap.set(ident, index);
		}
	}

	const localIdentIndex = localIdentMap.get(localIdent);
	if (typeof localIdentIndex !== 'number') {
		return new vscode.Hover("No such local variable in scope");
	}

	const localType = localIdentIndex < params.length ? "param" : "local";
	const hoverCode = `(${localType} ${localIdent} (${localTypes[localIdentIndex]}))`;
	const out = new vscode.MarkdownString();
	out.appendCodeblock(hoverCode, "wati");
	return new vscode.Hover(out);
}

const callHoverQuery = `(module_field_import 
  (name) (name)
  (import_desc
    (import_desc_func_type
      (identifier) @ident
      (func_type (func_type_params (func_type_params_many
        (value_type)* @param_type
      )))?
      (func_type (func_type_results
        (value_type)* @result_type
      ))?
    )? 
  )
)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node
 * @returns {vscode.Hover}
 * */
function getCallHoverString(language, node) {
	const callIdent = node.text;

	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) return new vscode.Hover("Could not resolve current function");

	const matches = queryWithErr(language, callHoverQuery, moduleNode);
	for (const { captures } of matches) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text;
		if (ident !== callIdent) continue;

		const params = captures.filter(({ name }) => name === "param_type").map(({ node }) => node.text);
		const results = captures.filter(({ name }) => name === "result_type").map(({ node }) => node.text);

		let hoverCode = `(func ${callIdent}`;
		if (params.length) hoverCode += ` (param ${params.join(" ")})`;
		if (results.length) hoverCode += ` (result ${results.join(" ")})`;
		hoverCode += ")";

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("No such function in scope");
}

module.exports = {
	getFunctionHoverString,
	getGlobalHoverString,
	getLocalHoverString,
	getCallHoverString,
};
