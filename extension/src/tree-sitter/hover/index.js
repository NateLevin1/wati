const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const getFunctionHoverString = require("./function.js");
const getGlobalHoverString = require("./global.js");
const getLocalHoverString = require("./local.js");
const getTableHoverString = require("./table.js");
const getTypeHoverString = require("./type.js");

/**
 *  @param {Parser.SyntaxNode} node
 * @returns {string}
 */
const getTypeTree = (node) => {
	if (!node.children.length) return ` (${node.type})`;
	return node.children.map((child) => {
		if (!child.children.length) return child.type;
		return `(${child.type} ${getTypeTree(child)})`
	}).join("");
};

/**
 * Get hover data for identifiers
 *
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node
 *
 * @returns {vscode.Hover | undefined}
 * */
function getHoverData(language, node) {
	if (node.type !== "identifier" || !node.parent) return;

	const parent = node.parent;

	if (parent.type === "module_field_func" || parent.type === "import_desc_func_type" || parent.type === "func_type_params_one") {
		return getFunctionHoverString(language, node);
	}

	if (parent?.parent?.type === "instr_plain") {
		const surroundingText = parent.parent.text;
		if (surroundingText.startsWith("global.")) {
			return getGlobalHoverString(language, node);
		}
		if (surroundingText.startsWith("local.")) {
			return getLocalHoverString(language, node);
		}
		if (surroundingText.startsWith("call")) {
			return getFunctionHoverString(language, node);
		}
	}

	if (parent?.parent?.type === "expr1_call") {
		if (parent.parent.text.startsWith("call_indirect")) {
			return getTableHoverString(language, node);
		}
	} else if (parent?.type === "module_field_table") {
		if (parent.text.startsWith("(table")) {
			return getTableHoverString(language, node);
		}
	} else if (parent?.parent?.type === "module_field_elem") {
		const [_, elem, table_name] = parent.parent.children;
		if (elem.text === "elem" && node.text === table_name.text) {
			return getTableHoverString(language, node);
		} else if (node.text !== table_name.text) {
			return getFunctionHoverString(language, node);
		}
	}

	if (parent?.parent?.type === "type_use") {
		if (parent.parent.text.startsWith("(type")) {
			return getTypeHoverString(language, node);
		}
	}

	if (parent?.type === "module_field_type") {
		if (parent.text.startsWith("(type")) {
			return getTypeHoverString(language, node);
		}
	}
}

module.exports = getHoverData;
