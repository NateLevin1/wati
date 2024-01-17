const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const { queryWithErr, getParentNode, getIdent } = require("./utils");

const functionHoverQuery = `
[
  (module_field_import 
    (import_desc
      (import_desc_func_type
        (identifier)? @ident
      ) @func_type
    )
  )
  (module_field_func 
    (identifier)? @ident
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
    (func_type_results (value_type)+ @result_type)? 
  )
  ]
`;

/**
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node
 * @returns {vscode.Hover}
 * */
function getFunctionHoverString(language, node) {
	const functionIdent = getIdent(node);

	const moduleNode = getParentNode(node, "module");
	if (!moduleNode) return new vscode.Hover("Could not resolve module");

	const matches = queryWithErr(language, functionHoverQuery, moduleNode);

	for (const [index, { captures }] of matches.entries()) {
		const ident = captures.find(({ name }) => name === "ident")?.node.text ?? index;
		if (ident !== functionIdent && index !== functionIdent) continue;

		const importFuncSignature = captures.find(({ name }) => name === "func_type");
		if (importFuncSignature) {
			const out = new vscode.MarkdownString();
			out.appendCodeblock(importFuncSignature.node.text, "wati");
			return new vscode.Hover(out);
		}

		let hoverCode = `(func ${ident}`;

		const params = [];
		for (let i = 0; i < captures.length ; i++) {
			const { name, node } = captures[i];

			if (name === 'params_ident') {
				i++;
				const paramIdent = node.text;
				const paramType = captures[i].node.text;
				params.push(`(param ${paramIdent} ${paramType})`);
			} else if (name === 'params_type') {
				const types = [];
				while (i < captures.length && captures[i].name === 'params_type') {
					types.push(captures[i].node.text);
					i++;
				}
				params.push(`(param ${types.join(' ')})`);
				i--;
			}
		}
		if (params.length) hoverCode += ' ' + params.join(' ');

		const result = captures.filter(({ name }) => name === "result_type").map(({ node }) => node.text);
		if (result.length) hoverCode += ` (result ${result.join(' ')})`;

		hoverCode += ")";

		const out = new vscode.MarkdownString();
		out.appendCodeblock(hoverCode, "wati");
		return new vscode.Hover(out);
	}

	return new vscode.Hover("Could not resolve function");
}

module.exports = getFunctionHoverString;
