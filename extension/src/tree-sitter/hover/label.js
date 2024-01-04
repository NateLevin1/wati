const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode } = require("./utils");

const labelHoverQuery = `(expr1 
	[
		(expr1_loop 
			(identifier) @ident
		) @label_body
		(expr1_block 
			(identifier) @ident
		) @label_body
	]
)`;
// (loop) @label_type 
// (block) @label_type 
		
/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node identifier
 * @returns {vscode.Hover}
 * */
function getLabelHoverString(language, node) {
	const callIdent = node.text;

	const funcNode = getParentNode(node, "module_field_func");
	if (!funcNode) return new vscode.Hover("Could not resolve current function");

	const matches = queryWithErr(language, labelHoverQuery, funcNode);
	
	for (const { captures } of matches) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text;
		if (ident !== callIdent) continue;

    const labelBody = captures.find(({ name }) => name === "label_body")?.node;
		const type = labelBody?.type.split('_')[1];
    
		const hoverCode = `(${type} ${ident})`;

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("No such type in scope");
}

module.exports = getLabelHoverString;