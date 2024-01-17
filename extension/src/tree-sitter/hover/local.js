const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode, getIdent } = require("./utils");

const localHoverQuery = `(module_field_func 
	(identifier)?
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
 * @param {Parser.SyntaxNode} node identifier
 * @returns {vscode.Hover}
 * */
function getLocalHoverString(language, node) {
	const localIdent = getIdent(node);

	const moduleNode = getParentNode(node, "module_field_func");
	if (!moduleNode) return new vscode.Hover("Could not resolve current function");

	const params = [];
	const localTypes = [];
	/** @type {Map<string, number>} */
	const identToIndex = new Map();
	/** @type {Map<number, string>} */
	const indexToIdent = new Map();

	const [{ captures }] = queryWithErr(language, localHoverQuery, moduleNode);
	for (const { name, node } of captures) {
		if (name === "params_type" || name === "locals_type") {
			const type = node.text;
			if (name === "params_type") params.push(type);
			localTypes.push(type);
		} else if (name === "params_ident" || name === "locals_ident") {
			const ident = node.text;
			const index = localTypes.length;
			identToIndex.set(ident, index);
			indexToIdent.set(index, ident);
		}
	}

	const localIdentIndex = typeof localIdent === "number" ? localIdent : identToIndex.get(localIdent);
	if (typeof localIdentIndex !== "number") {
		return new vscode.Hover("No such local variable in scope");
	}

	const localType = localIdentIndex < params.length ? "param" : "local";
	const name = typeof localIdent === "string" ? localIdent : indexToIdent.get(localIdent) ?? localIdent;
	const hoverCode = `(${localType} ${name} ${localTypes[localIdentIndex]})`;

	const out = new vscode.MarkdownString();
	out.appendCodeblock(hoverCode, "wati");
	return new vscode.Hover(out);
}

module.exports = getLocalHoverString;
