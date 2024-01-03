const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode } = require("./utils");

const typeHoverQuery = `(module_field_type
  (identifier) @ident 
  (type_field) @type
)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node identifier
 * @returns {vscode.Hover}
 * */
function getTypeHoverString(language, node) {
	const callIdent = node.text;

	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) return new vscode.Hover("Could not resolve current function");

	const matches = queryWithErr(language, typeHoverQuery, moduleNode);
	for (const { captures } of matches) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text;
		if (ident !== callIdent) continue;

    const typeInfo = captures.find(({ name }) => name === "type")?.node.text;
    
		const hoverCode = `(type ${ident} ${typeInfo})`;

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("No such type in scope");
}

module.exports = getTypeHoverString;