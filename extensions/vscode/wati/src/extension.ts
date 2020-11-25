import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('wati is now active.');

	const wati: vscode.DocumentSelector = { scheme:"file", language:"wati" };

	context.subscriptions.push(
		vscode.languages.registerHoverProvider(wati, new WatiHoverProvider)
	)
}

// this method is called when your extension is deactivated
export function deactivate() {}

class WatiHoverProvider implements vscode.HoverProvider {
	public provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
		): vscode.Hover
	{
		const word = document.getText(document.getWordRangeAtPosition(position, /[^ ();]+/));
		const char = document.getText(document.getWordRangeAtPosition(position, /./));

		// the chars that should never have a hover
		switch(char) {
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