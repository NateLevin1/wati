const Parser = require("web-tree-sitter");
const vscode = require("vscode");

const getFunctionHoverString = require("./function.js");
const getGlobalHoverString = require("./global.js");
const getLocalHoverString = require("./local.js");
const getTableHoverString = require("./table.js");
const getTypeHoverString = require("./type.js");
const getLabelHoverString = require("./label.js");

/**
 * Get hover data for identifiers
 *
 * @param {Parser.Language} language
 * @param {Parser.SyntaxNode} node
 *
 * @returns {vscode.Hover | undefined}
 * */
function getHoverData(language, node) {
	if (node.type !== "identifier" && node.type !== 'dec_nat') return;

	let parent = node.parent;
	if (node.type === 'dec_nat') {
		parent = node.parent?.parent ?? null;
	}
	if (!parent) return;
	
	if (parent.type === "expr1_loop" || parent.type === "expr1_block") {
		return getLabelHoverString(language, node);
	}
	if (parent.type === "module_field_global") {
		return getGlobalHoverString(language, node);
	}

	if (
		[
			"module_field_func",
			"import_desc_func_type",
			"func_type_params_one",
		].includes(parent.type)
	) {
		return getFunctionHoverString(language, node);
	}
	if (parent.parent?.type === "export_desc_func") {
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
		if (surroundingText.startsWith("br")) {
			return getLabelHoverString(language, node);
		}
	}

	if (parent?.parent?.type === "expr1_call") {
		if (parent.parent.text.startsWith("call_indirect")) {
			return getTableHoverString(language, node);
		}
	} else if (parent.type === "module_field_table") {
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

	if (parent.type === "module_field_type") {
		if (parent.text.startsWith("(type")) {
			return getTypeHoverString(language, node);
		}
	}
}

module.exports = getHoverData;
