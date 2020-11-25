"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    var _a;
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('wati is now active.');
    const wati = "wati";
    context.subscriptions.push(vscode.languages.registerHoverProvider(wati, new WatiHoverProvider));
    const curDoc = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document;
    if (curDoc) {
        updateFiles(curDoc);
    }
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(updateFiles));
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
const files = {};
const getVariablesInFile = (document) => {
    const returned = { globals: {}, functions: {} };
    const text = document.getText();
    let globals = [...text.matchAll(getGlobals)];
    globals.forEach((match) => {
        returned.globals[match[1]] = { type: match[3], isMutable: match[2] === "mut", name: match[1] };
    });
    let functions = [...text.matchAll(getFunctions)];
    functions.forEach((match) => {
        const paramString = match[2];
        let parameters = [];
        if (paramString) {
            const paramMatch = [...paramString.matchAll(getParamsOrLocals)];
            parameters = paramMatch.map(getNameType);
        }
        const localString = match[4];
        let locals = {};
        if (localString) {
            const localMatch = [...localString.matchAll(getParamsOrLocals)];
            const localsArr = localMatch.map(getNameType);
            for (const nameAndType of localsArr) {
                if (nameAndType.name) {
                    locals[nameAndType.name] = nameAndType;
                }
            }
        }
        returned.functions[match[1]] = {
            name: match[1],
            returnType: !match[3] ? null : match[3],
            parameters,
            locals
        };
    });
    return returned;
};
const updateFiles = (document) => {
    if (document.languageId === "wati") {
        files[document.uri.path] = getVariablesInFile(document);
        console.log(files);
    }
};
const getNameType = (m) => {
    let name;
    let type = "unknown";
    m.forEach((v) => {
        // if v starts with $ it is the name,
        // if v doesn't and it is not null
        // it is the type 
        if (v === null || v === void 0 ? void 0 : v.startsWith("$")) {
            name = v;
        }
        else if (!!v) {
            type = v;
        }
    });
    return { name, type };
};
const getGlobals = /\(global (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (?:\((mut) *)*(i32|i64|f32|f64)/g;
const getParamsOrLocals = /(?: *\((?:(?:param|local) +(?:(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) +)*(i32|i64|f32|f64)|(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (i32|i64|f32|f64))| (i32|i64|f32|f64))/g;
const getFunctions = /\((?:func)[^$]+(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)(?: |\(export[^)]+\))*((?:\((?:param | *\$)[^)]+\) *)+)*(?:\(result (i32|i64|f32|f64)\) *)*((?:\(local \$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]* (?:i32|i64|f32|f64)\) *)+)*/g;
const getFuncNameFromLine = /\((?:func)[^$]+(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)/;
const isLineAFunc = /\(func/;
class WatiHoverProvider {
    provideHover(document, position, token) {
        var _a;
        const word = document.getText(document.getWordRangeAtPosition(position, /[^ ();]+/));
        const char = document.getText(new vscode.Range(position, new vscode.Position(position.line, position.character + 1)));
        // get the current function
        // this is a hacky solution but since it is only used for local vars it works fine
        let curFunc;
        let curLineNum = position.line;
        while (curLineNum > 0) {
            const curLine = document.lineAt(curLineNum).text;
            if (isLineAFunc.test(curLine)) {
                // line is a func
                curFunc = (_a = curLine.match(getFuncNameFromLine)) === null || _a === void 0 ? void 0 : _a[1];
                break;
            }
            curLineNum -= 1;
        }
        // the chars that should never have a hover
        switch (char) {
            case " ":
            case "=":
            case ";":
            case "(":
            case ")":
                return null;
        }
        const file = files[document.uri.path];
        if (word.startsWith("$")) {
            // it is a global variable, local variable, function or label
            // FUNCTION
            const func = file.functions[word];
            if (func) {
                // it is a func
                const out = new vscode.MarkdownString();
                out.appendCodeblock(`(func ${func.name}${func.parameters.length === 0 ? "" : " "}${func.parameters.map((v) => `(${v.name} ${v.type})`).join(" ")})\n(result${func.returnType ? " " + func.returnType : ""})`);
                return new vscode.Hover(out);
            }
            // GLOBAL VARIABLE
            const valAtGlobal = file.globals[word];
            if (valAtGlobal) {
                const out = new vscode.MarkdownString();
                out.appendCodeblock(`(global ${valAtGlobal.name} ${valAtGlobal.type}) ${valAtGlobal.isMutable === true ? "(mut)" : ""}`, 'wati');
                return new vscode.Hover(out);
            }
            // LOCAL VARIABLE
            if (curFunc) { // must be in a function for a local var
                const valAtLocal = file.functions[curFunc].locals[word];
                if (valAtLocal) {
                    const out = new vscode.MarkdownString();
                    out.appendCodeblock(`(local ${valAtLocal.name} ${valAtLocal.type})`, 'wati');
                    return new vscode.Hover(out);
                }
            }
            // if nothing else has matched, just be unknown
            // ? Show red underline?
            return new vscode.Hover(`\tunknown`);
        }
        return new vscode.Hover(`${word}\n\nline: ${position.line}\ncharacter: ${position.character}`);
    }
}
//# sourceMappingURL=extension.js.map