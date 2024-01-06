const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode, getIdent } = require("./utils");

const typeHoverQuery = `(module_field_type
  (identifier)? @ident 
  (type_field) @type
)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node identifier
 * @returns {vscode.Hover}
 * */
function getTypeHoverString(language, node) {
	const typeIdent = getIdent(node);

	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) {
		return new vscode.Hover("Could not resolve current module");
	}

	const matches = queryWithErr(language, typeHoverQuery, moduleNode);
	for (const [index, { captures }] of matches.entries()) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text ?? index;
		if (ident !== typeIdent && index !== typeIdent) continue;

		const typeInfo = captures.find(({ name }) => name === "type")?.node.text;

		const hoverCode = `(type ${ident} ${typeInfo})`;

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("No such type in scope");
}

module.exports = getTypeHoverString;
