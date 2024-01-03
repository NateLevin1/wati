const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode } = require("./utils");

const tableHoverQuery = `(module_field_table identifier: (identifier) @ident 
  (table_fields_type (table_type
    (limits) @limits
    (ref_type) @ref_type
  )) 
)`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node identifier
 * @returns {vscode.Hover}
 * */
function getTableHoverString(language, node) {
	const callIdent = node.text;

	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) return new vscode.Hover("Could not resolve current function");

	const matches = queryWithErr(language, tableHoverQuery, moduleNode);
	for (const { captures } of matches) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text;
		if (ident !== callIdent) continue;

    const limits = captures.find(({ name }) => name === "limits")?.node.text;
    const refType = captures.find(({ name }) => name === "ref_type")?.node.text;
    
		const hoverCode = `(table ${ident} ${limits} ${refType})`;

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("No such table in scope");
}

module.exports = getTableHoverString;