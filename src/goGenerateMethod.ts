import vscode = require('vscode');
import { CommandFactory } from './commands';

const CommandTitle = 'Generate method';
const Command = 'go.generate.method';

export const goGenerateMethod: CommandFactory = () => (
	uncommontypeName: string,
	needPtrReceiver: boolean,
	endPos: vscode.Position
) => {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor found.');
		return;
	}
	const receiverName = getReceiverName(uncommontypeName);
	let methodTpl = `\n\nfunc ($\{4:${receiverName}} *${uncommontypeName}) $\{1:methodName}($\{2}) {\n\t$\{3}\n}\n\n`;
	if (!needPtrReceiver) {
		methodTpl = `\n\nfunc ($\{4:${receiverName}} ${uncommontypeName}) $\{1:methodName}($\{2}) {\n\t$\{3}\n}\n\n`;
	}
	editor.insertSnippet(new vscode.SnippetString(methodTpl), endPos);
};

export class MethodGenerationProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [vscode.CodeActionKind.Refactor];

	async provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	): Promise<vscode.CodeAction[] | undefined> {
		const lineText = document.lineAt(range.start.line).text;
		const uncommontypeName = await this.getUncommontypeName(lineText);

		if (uncommontypeName === '') {
			return;
		}

		let documentSymbols: vscode.DocumentSymbol[] = [];
		await vscode.commands
			.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri)
			.then((symbols) => {
				documentSymbols = symbols.filter((symbol) => {
					const res = symbol.name === uncommontypeName;
					return res;
				});
			});

		if (documentSymbols.length === 0) {
			return;
		}

		const endPos = documentSymbols[0].range.end;

		const genPointerReceiverMethod = new vscode.CodeAction(
			'generate method with pointer receiver',
			vscode.CodeActionKind.Refactor
		);
		genPointerReceiverMethod.command = {
			title: CommandTitle,
			command: Command,
			arguments: [uncommontypeName, true, endPos]
		};

		const genValueReceiverMethod = new vscode.CodeAction(
			'generate method with value receiver',
			vscode.CodeActionKind.Refactor
		);
		genValueReceiverMethod.command = {
			title: CommandTitle,
			command: Command,
			arguments: [uncommontypeName, false, endPos]
		};

		return [genPointerReceiverMethod, genValueReceiverMethod];
	}

	resolveCodeAction?(
		codeAction: vscode.CodeAction,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.CodeAction> {
		return;
	}

	private async getUncommontypeName(lineText: string): Promise<string> {
		// use regexp
		// let regexp = /type [^0-9]\w+/;
		if (lineText.indexOf('interface') !== -1 || lineText.indexOf('=') !== -1) {
			return '';
		}
		let trimedLineText = lineText.trim();
		const braceIdx = trimedLineText.indexOf('{');
		if (braceIdx !== -1) {
			trimedLineText = trimedLineText.substring(0, braceIdx);
		}
		const fields = trimedLineText.split(' ');
		if (fields.length < 2) {
			return '';
		}
		let res = '';
		if (fields.length === 2) {
			res = fields[0];
		}
		res = fields[1];
		return res;
	}
}

function getReceiverName(structName: string): string {
	let res = '';
	for (let i = 0; i < structName.length; i++) {
		const ch = structName.charCodeAt(i);
		if (isUpperCase(ch)) {
			res += String.fromCharCode(ch + 32);
		}
	}
	if (res === '') {
		res = structName.charAt(0).toLowerCase();
	}
	return res;
}

const isUpperCase = (ch: number): boolean => {
	return 65 <= ch && ch <= 90;
};
