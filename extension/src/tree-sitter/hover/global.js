const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode, getIdent } = require("./utils");

const globalHoverQuery = `
	[
		(module_field_global (identifier)? @ident (global_type) @global_type)
		(import_desc_global_type (identifier)? @ident (global_type) @global_type)
	]
`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node identifier
 * @returns {vscode.Hover}
 * */
function getGlobalHoverString(language, node) {
	const globalIdent = getIdent(node);

	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) return new vscode.Hover("Could not resolve module");

	const matches = queryWithErr(language, globalHoverQuery, moduleNode);
	for (const [index, { captures }] of matches.entries()) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text ?? index;
		if (ident !== globalIdent) continue;

		const type = captures.find(({ name }) => name === "global_type")?.node.text;

		const hoverCode = `(global ${ident} ${type})`;

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("No such global variable in scope");
}

module.exports = getGlobalHoverString;
