"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const completions_1 = require("./completions");
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log("wati is now active.");
    const wati = "wati";
    const wat = "wat";
    // WATI
    context.subscriptions.push(vscode.languages.registerHoverProvider(wati, new WatiHoverProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(wati, new WatiVariableCompletionProvider(), ".", "$", "@"));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(wati, new WatiSyntaxCompletionProvider(), ...WatiSyntaxCompletionProvider.triggerCharacters));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(wati, new WatiSignatureHelpProvider(), "(", ","));
    // WAT
    context.subscriptions.push(vscode.languages.registerHoverProvider(wat, new WatiHoverProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(wat, new WatiVariableCompletionProvider(), ".", "$", "@"));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(wat, new WatiSyntaxCompletionProvider(), ...WatiSyntaxCompletionProvider.triggerCharacters));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(wat, new WatiSignatureHelpProvider(), "(", ","));
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
// SIGNATURE HELP
class WatiSignatureHelpProvider {
    provideSignatureHelp(document, position, token, sigHelpContext) {
        var _a, _b, _c;
        // disable if wat and not on in wat
        if (document.languageId === "wat" && !vscode.workspace.getConfiguration("wati").useIntellisenseInWatFiles) {
            return undefined;
        }
        if (sigHelpContext.triggerKind === 2) {
            const sigHelp = (_a = sigHelpContext.activeSignatureHelp) !== null && _a !== void 0 ? _a : new vscode.SignatureHelp();
            // determine the most recent call so we know what to show
            const strFromLastCall = getCallAtCursor(document.lineAt(position).text, position.character);
            // get the name and args of the function and show them
            const match = strFromLastCall.match(getNameAndParamOfCall);
            if (match) {
                // we need to update files so that we know if the func exists
                updateFiles(document);
                const [full, name, args] = match;
                const funcRef = files[document.uri.path].functions[name];
                if (funcRef) {
                    const sig = new vscode.SignatureInformation(getStringFromFuncRef(funcRef));
                    sig.parameters = [
                        ...funcRef.parameters
                            .filter((p) => !!p.name)
                            .map((p) => new vscode.ParameterInformation(`(${p.name} ${p.type})`)),
                    ];
                    sigHelp.activeParameter = ((_b = args.match(/,/g)) !== null && _b !== void 0 ? _b : []).length;
                    sigHelp.activeSignature = 0;
                    sigHelp.signatures = [sig];
                    return sigHelp;
                }
                else {
                    sigHelp.activeParameter = 0;
                    sigHelp.activeSignature = 0;
                    sigHelp.signatures = [new vscode.SignatureInformation('unknown function "' + name + '"')];
                    return sigHelp;
                }
            }
            else {
                return undefined;
            }
        }
        else {
            const sigHelp = (_c = sigHelpContext.activeSignatureHelp) !== null && _c !== void 0 ? _c : new vscode.SignatureHelp();
            return sigHelp;
        }
    }
}
const getCallAtCursor = (line, cursorPos, previousLine) => {
    let openParenIndex = line.indexOf("(");
    if (openParenIndex !== -1) {
        if (openParenIndex !== -1) {
            let args = line.slice(openParenIndex + 1);
            // find close paren index
            let numOfParens = 1;
            let curCharIndex = 0;
            while (numOfParens > 0 && curCharIndex < args.length) {
                const curChar = args[curCharIndex];
                if (curChar === "(") {
                    numOfParens++;
                }
                else if (curChar === ")") {
                    numOfParens--;
                }
                curCharIndex++;
            }
            // get the absolute location of the end paren
            let closeParenIndex = curCharIndex + openParenIndex;
            if (cursorPos > openParenIndex && cursorPos < closeParenIndex + 1) {
                // cursor is between the opening and closing parens, check for more calls
                return getCallAtCursor(line.slice(openParenIndex + 1, closeParenIndex), cursorPos - openParenIndex - 1, line);
            }
            else {
                // it isn't between the two, should be the last one or if there is another ( we keep trying
                const nextOpenParam = line.slice(openParenIndex + 1).indexOf("(");
                if (nextOpenParam !== -1) {
                    return getCallAtCursor(line.slice(closeParenIndex + 1), cursorPos - closeParenIndex - 1, previousLine);
                }
                else {
                    return previousLine !== null && previousLine !== void 0 ? previousLine : line;
                }
            }
        }
    }
    else {
        return previousLine !== null && previousLine !== void 0 ? previousLine : line;
    }
    return previousLine !== null && previousLine !== void 0 ? previousLine : line;
};
// COMPLETION
const mapVariables = ({ prefix, wasmInstr, variables, position, wasmAfterVar, command, }) => {
    return variables.map((completionItem) => {
        const varName = completionItem.label;
        const fullTypedText = prefix + "$" + varName;
        const textToInsert = `(${wasmInstr} $${varName}${wasmAfterVar !== null && wasmAfterVar !== void 0 ? wasmAfterVar : ""})`;
        return completions_1.makeCompletionItem(fullTypedText, {
            range: new vscode.Range(position.with(undefined, position.character - prefix.length - 1), position),
            insertText: textToInsert,
            documentation: new vscode.MarkdownString(completionItem.detail + "\n```wasm\n" + textToInsert + "\n```"),
            command: command,
        });
    });
};
class WatiVariableCompletionProvider {
    provideCompletionItems(document, position, token, completionContext) {
        // disable if wat and not on in wat
        if (document.languageId === "wat" && !vscode.workspace.getConfiguration("wati").useIntellisenseInWatFiles) {
            return undefined;
        }
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        for (const shouldEndWith in completions_1.completionItems) {
            if (linePrefix.endsWith(shouldEndWith)) {
                return completions_1.completionItems[shouldEndWith];
            }
        }
        if (linePrefix.endsWith("$")) {
            // show available functions/variables.
            updateFiles(document);
            if (linePrefix.endsWith("call $")) {
                // show available funcs
                return Object.values(files[document.uri.path].functions)
                    .filter((value) => !value.name.startsWith("__WATI_EXPORTED__"))
                    .map(({ name, parameters, returnType }) => completions_1.makeCompletionItem(name.slice(1), {
                    detail: /**The flatMap makes sure there are only two displayed on each line */ `${parameters
                        .flatMap((p, i) => {
                        let str = `(${p.name ? p.name + " " : ""}${p.type}) `;
                        if ((i + 1) % 2 === 0)
                            return [str, "\n"];
                        return [str];
                    })
                        .join("")}${parameters.length > 0 ? "\n\n" : ""}(result${returnType ? " " + returnType : ""})`,
                }));
            }
            const curFunc = getCurFunc(document, position);
            const isBranch = linePrefix.match(/br(?:_if)?\s*\$$/);
            if (curFunc && isBranch) {
                return [
                    ...Object.values(files[document.uri.path].functions[curFunc].blocks).map((v) => completions_1.makeCompletionItem({ name: v.label }.name.slice(1), { detail: `${v.type} ${v.label} on line ${v.lineNum}` })),
                ];
            }
            const isLocalVar = linePrefix.endsWith("l$");
            const localVariables = !!curFunc
                ? [
                    ...Object.values(files[document.uri.path].functions[curFunc].locals)
                        .filter((v) => !!v.name)
                        .map((v) => completions_1.makeCompletionItem(v.name.slice(1), { detail: `(local) ${v.type}` })),
                    ...files[document.uri.path].functions[curFunc].parameters
                        .filter((v) => !!v.name)
                        .map((v) => completions_1.makeCompletionItem(v.name.slice(1), { detail: `(param) ${v.type}` })),
                ]
                : [];
            if (isLocalVar) {
                return mapVariables({ prefix: "l", wasmInstr: "local.get", variables: localVariables, position });
            }
            const isSettingLocalVar = linePrefix.endsWith("l=$");
            if (isSettingLocalVar) {
                return mapVariables({
                    prefix: "l=",
                    wasmInstr: "local.set",
                    variables: localVariables,
                    position,
                    wasmAfterVar: " ",
                    command: {
                        command: "cursorMove",
                        title: "Cursor Move",
                        arguments: [{ to: "left" }],
                    },
                });
            }
            const isGlobalVar = linePrefix.endsWith("g$");
            const globalVariables = Object.values(files[document.uri.path].globals)
                .filter((v) => !!v.name)
                .map((v) => completions_1.makeCompletionItem(v.name.slice(1), { detail: `(global) ${v.type}` }));
            if (isGlobalVar) {
                return mapVariables({ prefix: "g", wasmInstr: "global.get", variables: globalVariables, position });
            }
            const isSettingGlobalVar = linePrefix.endsWith("g=$");
            if (isSettingGlobalVar) {
                return mapVariables({
                    prefix: "g=",
                    wasmInstr: "global.set",
                    variables: globalVariables,
                    position,
                    wasmAfterVar: " ",
                    command: {
                        command: "cursorMove",
                        title: "Cursor Move",
                        arguments: [{ to: "left" }],
                    },
                });
            }
            return [...globalVariables, ...localVariables];
        }
        return undefined;
    }
}
class WatiSyntaxCompletionProvider {
    provideCompletionItems(document, position, token, completionContext) {
        // disable if wat and not on in wat
        if (document.languageId === "wat" && !vscode.workspace.getConfiguration("wati").useIntellisenseInWatFiles) {
            return undefined;
        }
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        // match & convert number constants - e.g. 5i32, 5.11f64, 500_000_000i64
        const numberConstantMatch = linePrefix.match(/([\d|.|_]+)((?:i|f)(?:32|64))$/);
        if (numberConstantMatch) {
            const [fullMatch, number, type] = numberConstantMatch;
            const textToInsert = `(${type}.const ${number.replace(/_/g, "")})`;
            return [completions_1.makeCompletionItem(fullMatch, { insertText: textToInsert, detail: "insert: " + textToInsert })];
        }
    }
}
WatiSyntaxCompletionProvider.triggerCharacters = ["2", "4", "$"];
// HOVER
const files = {};
const getVariablesInFile = (document) => {
    const returned = { globals: {}, functions: {} };
    const text = document.getText();
    let globals = [...text.matchAll(getGlobals)];
    globals.forEach((match) => {
        returned.globals[match[1]] = {
            name: match[1],
            isMutable: match[2] === "mut",
            type: match[3],
            initialValue: match[4],
        };
    });
    let functions = [...text.matchAll(getFunctions)];
    functions.forEach((match) => {
        var _a;
        let name = match[1];
        const paramString = match[2];
        const returnType = match[3];
        const localString = match[4];
        if (!name) {
            // this can happen, so we rely on export name
            let exportName = (_a = match[0].match(getExport)) === null || _a === void 0 ? void 0 : _a[1];
            // if there isn't an export, we give up
            if (!exportName)
                return;
            name = "__WATI_EXPORTED__" + exportName;
        }
        let parameters = [];
        if (paramString) {
            const paramMatch = [...paramString.matchAll(getParamsOrLocals)];
            parameters = paramMatch.map(getNameType);
        }
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
        returned.functions[name] = {
            name,
            returnType: !returnType ? null : returnType,
            parameters,
            locals,
            blocks: {},
        };
    });
    const lines = text.split(/^/gm);
    for (var i = 0; i < lines.length; i++) {
        const line = lines[i];
        const block = line.match(getBlock);
        if (!block)
            continue;
        const [_, blockType, blockLabel] = block;
        const funcNameOfBlock = getCurFunc(document, { line: i });
        if (!funcNameOfBlock)
            continue;
        const funcOfBlock = returned.functions[funcNameOfBlock];
        if (!funcOfBlock)
            continue;
        funcOfBlock.blocks[blockLabel] = {
            type: blockType,
            label: blockLabel,
            lineNum: i + 1,
        };
    }
    return returned;
};
const updateFiles = (document) => {
    // if is wati or is wat and wat is enabled
    if (document.languageId === "wati" ||
        (document.languageId === "wat" && vscode.workspace.getConfiguration("wati").useIntellisenseInWatFiles)) {
        files[document.uri.path] = getVariablesInFile(document);
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
const getGlobals = /\(global (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (?:\((mut) *)*(i32|i64|f32|f64)(?:\s*\(([^)]+)\))?/g;
const getParamsOrLocals = /(?: *\((?:(?:param +|local +|l)(?:(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) +)*(i32|i64|f32|f64)|(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (i32|i64|f32|f64))| (i32|i64|f32|f64))/g;
const getFunctions = /\((?:\s*func)(?:\s*(?:\(.*?\)\s*)*?|\s*)(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)?(?: |\s*\(export[^)]+?\)(?:\s+;;.+)*)*((?:\s*\((?:param | *\$)[^)]+\)\s*(?:;;.+)*)+)*(?:\s*\(result (i32|i64|f32|f64)\)\s*(?:;;.+)*)*\s*((?:\s*\((?:local\s+|l)(?:\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*\s+)?(?:i32|i64|f32|f64)\)\s*(?:;;.+)?)+)*/g;
const getFuncNameFromLine = /\((?:\s*func)(?:\s*(?:\(.*?\)\s*)*?|\s*)(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)/;
const isLineAFunc = /\(func/;
const getNameAndParamOfCall = /call (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)(\((?:[^,\n]*(?:,|\)))*)/;
const getExport = /\(\s*export\s*"([^"]+)"\)/;
const getBlock = /(?:\s+|^)(block|loop|if)\s*(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*)/;
const getCurFunc = (document, { line: curLineNum }) => {
    var _a, _b;
    // this is a hacky solution but since it is only used for local vars it works fine
    let curFunc;
    while (curLineNum > 0) {
        const curLine = document.lineAt(curLineNum).text;
        if (isLineAFunc.test(curLine)) {
            // line is a func
            curFunc = (_a = curLine.match(getFuncNameFromLine)) === null || _a === void 0 ? void 0 : _a[1];
            if (!curFunc) {
                // try to use export
                const exportName = (_b = curLine.match(getExport)) === null || _b === void 0 ? void 0 : _b[1];
                if (exportName) {
                    curFunc = "__WATI_EXPORTED__" + exportName;
                }
            }
            break;
        }
        curLineNum -= 1;
    }
    return curFunc;
};
const getStringFromFuncRef = (func) => {
    return `(func ${func.name}${func.parameters.length === 0 ? "" : " "}${func.parameters
        .map((v) => `(${v.name ? v.name + " " : ""}${v.type})`)
        .join(" ")})\n(result${func.returnType ? " " + func.returnType : ""})`;
};
class WatiHoverProvider {
    provideHover(document, position, token) {
        // disable if wat and not on in wat
        if (document.languageId === "wat" && !vscode.workspace.getConfiguration("wati").useIntellisenseInWatFiles) {
            return null;
        }
        updateFiles(document);
        const word = document.getText(document.getWordRangeAtPosition(position, /[^ ();,]+/)).trim();
        const char = document.getText(new vscode.Range(position, new vscode.Position(position.line, position.character + 1)));
        // get the current function
        const curFunc = getCurFunc(document, position);
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
            // it is a global variable, local variable, function or block label
            // FUNCTION
            const func = file.functions[word];
            if (func) {
                // it is a func
                const out = new vscode.MarkdownString();
                out.appendCodeblock(getStringFromFuncRef(func));
                return new vscode.Hover(out);
            }
            // GLOBAL VARIABLE
            const valAtGlobal = file.globals[word];
            if (valAtGlobal) {
                const out = new vscode.MarkdownString();
                out.appendCodeblock(`(global ${valAtGlobal.name} ${valAtGlobal.type}) ${valAtGlobal.isMutable === true ? "(mut)" : ""}`, "wati");
                if (valAtGlobal.initialValue) {
                    out.appendCodeblock("  = " + valAtGlobal.initialValue, "wati");
                }
                return new vscode.Hover(out);
            }
            // LOCAL VARIABLE
            if (curFunc) {
                // must be in a function for a local var
                const valAtLocal = file.functions[curFunc].locals[word];
                if (valAtLocal) {
                    const out = new vscode.MarkdownString();
                    out.appendCodeblock(`(local ${valAtLocal.name} ${valAtLocal.type})`, "wati");
                    return new vscode.Hover(out);
                }
            }
            // FUNCTION PARAMETER
            if (curFunc) {
                // must be in a function for a param
                const paramRef = file.functions[curFunc].parameters;
                const wordIndex = paramRef.findIndex((v) => v.name === word);
                const valAtParam = wordIndex !== -1 ? paramRef[wordIndex] : undefined;
                if (valAtParam) {
                    const out = new vscode.MarkdownString();
                    out.appendCodeblock(`(param ${valAtParam.name} ${valAtParam.type})`, "wati");
                    return new vscode.Hover(out);
                }
            }
            // BLOCK LABEL
            if (curFunc) {
                const block = file.functions[curFunc].blocks[word];
                if (block) {
                    const out = new vscode.MarkdownString();
                    out.appendCodeblock(`${block.type} ${block.label} ;; on line ${block.lineNum}`, "wati");
                    return new vscode.Hover(out);
                }
            }
            // if nothing else has matched, just be unknown
            // ? Show red underline?
            return new vscode.Hover(`\tunknown`);
        }
        else if (word.startsWith("l$")) {
            // local var definition
            const realVar = word.slice(1);
            if (curFunc) {
                // must be in a function for a local var
                const valAtLocal = file.functions[curFunc].locals[realVar];
                if (valAtLocal) {
                    const out = new vscode.MarkdownString();
                    out.appendCodeblock(`(local ${valAtLocal.name} ${valAtLocal.type})`, "wati");
                    return new vscode.Hover(out);
                }
            }
            return new vscode.Hover(`\tunknown`);
        }
        else {
            // might be an instruction or just a random word
            const capturedWord = word.match(/(i32|i64|f32|f64)\.(\S+)/);
            if (capturedWord) {
                // is an instruction
                let doc = completions_1.instructionDocs["TYPE." + capturedWord[2]]; // check if there is a global type
                doc = !!doc ? doc : completions_1.instructionDocs[`${capturedWord[1]}.${capturedWord[2]}`]; // if there isn't, check if there is a more specific type
                return new vscode.Hover(`${!!doc ? doc.replace(/TYPE/g, capturedWord[1]) : "No documentation available."}`);
            }
            else if (completions_1.instructionDocs[word]) {
                return new vscode.Hover(completions_1.instructionDocs[word]);
            }
        }
        return null;
        // DEBUG: return new vscode.Hover(`${word}\n\nline: ${position.line}\ncharacter: ${position.character}`);
    }
}
//# sourceMappingURL=extension.js.map