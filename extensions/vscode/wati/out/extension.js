"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('wati is now active.');
    const wati = { scheme: "file", language: "wati" };
    context.subscriptions.push(vscode.languages.registerHoverProvider(wati, new WatiHoverProvider));
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
class WatiHoverProvider {
    provideHover(document, position, token) {
        const word = document.getText(document.getWordRangeAtPosition(position, /[^ ();]+/));
        const char = document.getText(document.getWordRangeAtPosition(position, /./));
        // the chars that should never have a hover
        switch (char) {
            case " ":
            case "=":
            case ";":
            case "(":
            case ")":
                return new vscode.Hover("");
        }
        return new vscode.Hover(`${word}\n\nline: ${position.line}\ncharacter: ${position.character}`);
    }
}
//# sourceMappingURL=extension.js.map