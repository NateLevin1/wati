const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode } = require("./utils");

const functionHoverQuery = `
[
  (module_field_import 
    (import_desc
      (import_desc_func_type
        (identifier) @ident
      ) @func_type
    )
  )
  (module_field_func identifier: (identifier)? @ident
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
  )
  ]
`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node either module_field_func or import_desc_func_type
 * @returns {vscode.Hover}
 * */
function getFunctionHoverString(language, node) {
	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) return new vscode.Hover("Could not resolve module");

	const matches = queryWithErr(language, functionHoverQuery, moduleNode);

	for (const { captures } of matches) {
		const name = captures.find(({ name }) => name === "ident")?.node.text;

		if (name !== node.text) continue;

		const importFuncSignature = captures.find(({ name }) => name === "func_type");
		if (importFuncSignature) {
			const out = new vscode.MarkdownString();
			out.appendCodeblock(importFuncSignature.node.text, "wati");
			return new vscode.Hover(out);
		}

		let hoverCode = `(func ${name}`;

		const params = captures
			.filter(({ name }) => name === "params_type")
			.map(({ node }) => node.text);
		if (params.length) hoverCode += ` (param ${params.join(" ")})`;

		const result = captures.find(({ name }) => name === "result_type")?.node.text;
		if (result) hoverCode += ` (result ${result})`;

		hoverCode += ")";

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("Could not resolve function");
}

module.exports = getFunctionHoverString;
