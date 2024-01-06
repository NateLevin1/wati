const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode, getIdent } = require("./utils");

const labelHoverQuery = `(expr1 
	[
		(expr1_loop 
			(identifier)? @ident
		) @label_body
		(expr1_block 
			(identifier)? @ident
		) @label_body
	]
)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node identifier
 * @returns {vscode.Hover}
 * */
function getLabelHoverString(language, node) {
	const labelIdent = getIdent(node);

	const funcNode = getParentNode(node, "module_field_func");
	if (!funcNode) return new vscode.Hover("Could not resolve current function");

	const matches = queryWithErr(language, labelHoverQuery, funcNode);

	for (const [index, { captures }] of matches.entries()) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text ?? index;
		if (ident !== labelIdent && index !== labelIdent) continue;

		const labelBody = captures.find(({ name }) => name === "label_body")?.node;
		const type = labelBody?.type.split("_")[1];

		const hoverCode = `(${type} ${ident})`;

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("No such label in scope");
}

module.exports = getLabelHoverString;
