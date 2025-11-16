// src/extension.ts
// Entry point for Reactive Themes extension

import * as vscode from 'vscode';
import { ThemeManager } from './themeManager';
import { evaluateRules, getRuleDescription } from './ruleEngine';
import { loadConfig, validateConfig } from './config';

// global theme manager instance
let themeManager: ThemeManager | undefined;

// * activate extension & register commands, listeners, & theme manager
export function activate(context: vscode.ExtensionContext) {
	console.log('[Reactive Themes] Extension activating...');

	// initialize theme manager
	themeManager = new ThemeManager();

	// load initial configuration & set enabled state
	const config = loadConfig();
	themeManager.setEnabled(config.enabled);

	// validate configuration & warn on errors
	const validation = validateConfig(config);
	if (!validation.valid) {
		console.warn('[Reactive Themes] Configuration errors:', validation.errors);
		vscode.window.showWarningMessage(
			`Reactive Themes: Configuration has errors. Check the developer console for details.`
		);
	}

	// apply theme for currently active editor on activation
	if (vscode.window.activeTextEditor) {
		handleEditorChange(vscode.window.activeTextEditor);
	}

	// command: toggle enable/disable
	const toggleCommand = vscode.commands.registerCommand('reactiveThemes.toggle', () => {
		if (!themeManager) {
			return;
		}

		const currentState = themeManager.getEnabled();
		const newState = !currentState;
		themeManager.setEnabled(newState);

		// persist enabled state to configuration
		vscode.workspace.getConfiguration('reactiveThemes').update('enabled', newState, true);

		vscode.window.showInformationMessage(
			`Reactive Themes ${newState ? 'enabled' : 'disabled'}`
		);
	});

	// command: reload rules & re-evaluate current editor
	const reloadCommand = vscode.commands.registerCommand('reactiveThemes.reloadRules', () => {
		const config = loadConfig();
		const validation = validateConfig(config);

		if (!validation.valid) {
			vscode.window.showErrorMessage(
				`Reactive Themes: Configuration has errors: ${validation.errors.join(', ')}`
			);
			return;
		}

		vscode.window.showInformationMessage(
			`Reactive Themes: Reloaded ${config.rules.length} rule(s)`
		);

		// re-evaluate w/ current editor
		if (vscode.window.activeTextEditor) {
			handleEditorChange(vscode.window.activeTextEditor);
		}
	});

	// command: show active rule for current editor
	const showActiveRuleCommand = vscode.commands.registerCommand('reactiveThemes.showActiveRule', () => {
		if (!vscode.window.activeTextEditor) {
			vscode.window.showInformationMessage('Reactive Themes: No active editor');
			return;
		}

		const config = loadConfig();
		const editor = vscode.window.activeTextEditor;
		const result = evaluateRules(config.rules, editor);

		const languageId = editor.document.languageId;
		const filePath = editor.document.uri.fsPath;
		const workspaceName = vscode.workspace.name || 'N/A';

		let message = `**Current File Info:**\n`;
		message += `- Language ID: \`${languageId}\`\n`;
		message += `- File: \`${filePath}\`\n`;
		message += `- Workspace: \`${workspaceName}\`\n\n`;

		if (result.matched && result.rule) {
			const ruleDesc = getRuleDescription(result.rule);
			message += `**Matched Rule:** "${result.rule.name}"\n`;
			message += `- Conditions: ${ruleDesc}\n`;
			message += `- Theme: \`${result.theme}\`\n`;
		} else {
			message += `**No rules matched**\n`;
			if (config.defaultTheme) {
				message += `- Using default theme: \`${config.defaultTheme}\`\n`;
			} else {
				message += `- Using original theme\n`;
			}
		}

		// show as information message w/ markdown stripped
		vscode.window.showInformationMessage(message.replace(/\*\*/g, '').replace(/`/g, '"'));
	});

	// listen for active editor changes & apply theme rules
	const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
		handleEditorChange(editor);
	});

	// listen for new document opens & re-evaluate theme
	const languageChangeListener = vscode.workspace.onDidOpenTextDocument(() => {
		// re-evaluate when new document is opened
		if (vscode.window.activeTextEditor) {
			handleEditorChange(vscode.window.activeTextEditor);
		}
	});

	// listen for document language mode changes
	const documentLanguageListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			handleEditorChange(editor);
		}
	});

	// listen for reactiveThemes.* config changes & reload
	const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('reactiveThemes')) {
			const config = loadConfig();
			if (themeManager) {
				themeManager.setEnabled(config.enabled);
			}

			// re-evaluate rules w/ current editor
			if (vscode.window.activeTextEditor) {
				handleEditorChange(vscode.window.activeTextEditor);
			}
		}
	});

	// register all disposables for cleanup
	context.subscriptions.push(
		toggleCommand,
		reloadCommand,
		showActiveRuleCommand,
		editorChangeListener,
		languageChangeListener,
		documentLanguageListener,
		configChangeListener,
		themeManager
	);

	console.log('[Reactive Themes] Extension activated successfully');
}

// handle editor change events & apply appropriate theme
function handleEditorChange(editor: vscode.TextEditor | undefined): void {
	if (!themeManager || !editor) {
		return;
	}

	// load current configuration
	const config = loadConfig();

	// bail out early if disabled
	if (!config.enabled) {
		return;
	}

	// evaluate rules against current editor
	const result = evaluateRules(config.rules, editor);

	if (result.matched && result.theme) {
		// rule matched - apply its theme
		const ruleDescription = result.rule ? getRuleDescription(result.rule) : 'unknown';
		themeManager.applyTheme(result.theme, `matched rule: ${ruleDescription}`);
	} else {
		// no rules matched - apply fallback theme
		themeManager.applyFallback(config.defaultTheme);
	}
}

// deactivate extension & restore original theme
export function deactivate() {
	console.log('[Reactive Themes] Extension deactivating...');

	// restore original theme on deactivation
	if (themeManager) {
		themeManager.restoreOriginalTheme();
	}
}
