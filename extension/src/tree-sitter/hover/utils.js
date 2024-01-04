const Parser = require("web-tree-sitter");

/**
 * @param {Parser.Language} language
 * @param {string} queryStr
 * @param {Parser.SyntaxNode} node
 * */
function queryWithErr(language, queryStr, node) {
	try {
		const query = language.query(queryStr);
		return query.matches(node);
	} catch (e) {
		console.log(e);
		throw e;
	}
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {string} type
 * */
function getParentNode(node, type) {
	let curNode = node;
	while (curNode?.parent) {
		curNode = curNode.parent;
		if (curNode.type === type) return curNode;
	}
}

module.exports = { queryWithErr, getParentNode };
