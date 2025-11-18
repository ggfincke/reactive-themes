// src/extension.ts
// Entry point for Reactive Themes extension

import * as vscode from 'vscode';
import { ThemeManager } from './themeManager';
import { evaluateRules, getRuleDescription } from './ruleEngine';
import { loadConfig, validateConfig } from './config';
import { createRuleFromCurrentFile } from './commands/createRule';
import { manageRules } from './commands/manageRules';
import { cleanupDuplicateRules } from './commands/cleanupRules';
import { testRule } from './commands/testRule';
import { lintRulesCommand } from './commands/lintRules';
import { ContextManager } from './contextManager';
import { DebugTrigger } from './triggers/debugTrigger';
import { TimerTrigger } from './triggers/timerTrigger';
import { ViewTrigger } from './triggers/viewTrigger';
import { TestTrigger } from './triggers/testTrigger';
import { ThemeRule } from './types';

// global theme manager instance
let themeManager: ThemeManager | undefined;

// global context manager and triggers
let contextManager: ContextManager | undefined;
let debugTrigger: DebugTrigger | undefined;
let timerTrigger: TimerTrigger | undefined;
let viewTrigger: ViewTrigger | undefined;
let testTrigger: TestTrigger | undefined;

// * activate extension & register commands, listeners, & theme manager
export async function activate(context: vscode.ExtensionContext) {
	console.log('[Reactive Themes] Extension activating...');

	// load initial configuration & set enabled state
	const config = loadConfig();

	// initialize theme manager
	themeManager = new ThemeManager(config.debounceMs);
	await themeManager.setEnabled(config.enabled);

	// initialize context manager
	contextManager = new ContextManager();
	let lastContextSnapshot = contextManager.getContext();

	// initialize triggers
	debugTrigger = new DebugTrigger(contextManager);
	viewTrigger = new ViewTrigger(contextManager);
	testTrigger = new TestTrigger(contextManager);

	// initialize timer trigger with callback to apply theme
	timerTrigger = new TimerTrigger(contextManager, (ruleIndices: number[], rules: ThemeRule[]) => {
		if (!themeManager || !themeManager.getEnabled()) {
			return;
		}

		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		if (!contextManager) {
			return;
		}

		const currentContext = contextManager.getContext();
		const timerIndices = new Set<number>(ruleIndices);
		const result = evaluateRules(rules, editor, currentContext, {
			allowTimerRules: true,
			activeTimerRuleIndices: timerIndices,
			timerOnly: true
		});

		if (result.matched && result.rule) {
			const ruleDescription = getRuleDescription(result.rule);
			themeManager.applyTheme(result.rule.theme, `timer trigger: ${ruleDescription}`);
		}
	});

	// register timer-based rules
	timerTrigger.registerTimerRules(config.rules);

	// listen to context changes and re-evaluate rules
	contextManager.onDidChangeContext((newContext) => {
		// ignore timer-only context changes; timer trigger handles theme application
		const timerOnlyChange =
			lastContextSnapshot &&
			newContext.timerTick !== lastContextSnapshot.timerTick &&
			newContext.debugSession === lastContextSnapshot.debugSession &&
			newContext.debugType === lastContextSnapshot.debugType &&
			newContext.testState === lastContextSnapshot.testState &&
			newContext.viewMode === lastContextSnapshot.viewMode;

		lastContextSnapshot = newContext;

		if (timerOnlyChange) {
			return;
		}

		if (vscode.window.activeTextEditor) {
			handleEditorChange(vscode.window.activeTextEditor);
		}
	});

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
	const toggleCommand = vscode.commands.registerCommand('reactiveThemes.toggle', async () => {
		if (!themeManager) {
			return;
		}

		const currentState = themeManager.getEnabled();
		const newState = !currentState;
		await themeManager.setEnabled(newState);

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

		// re-register timer rules
		if (timerTrigger) {
			timerTrigger.registerTimerRules(config.rules);
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
		const currentContext = contextManager?.getContext() || {};
		const result = evaluateRules(config.rules, editor, currentContext);

		const languageId = editor.document.languageId;
		const filePath = editor.document.uri.fsPath;
		const workspaceName = vscode.workspace.name || 'N/A';

		let message = `**Current File Info:**\n`;
		message += `- Language ID: \`${languageId}\`\n`;
		message += `- File: \`${filePath}\`\n`;
		message += `- Workspace: \`${workspaceName}\`\n\n`;

		message += `**Current Context:**\n`;
		message += `- Debug: \`${currentContext.debugSession}\`${currentContext.debugType ? ` (${currentContext.debugType})` : ''}\n`;
		message += `- Test: \`${currentContext.testState}\`\n`;
		message += `- View: \`${currentContext.viewMode}\`\n\n`;

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

	// command: create rule from current file
	const createRuleCommand = vscode.commands.registerCommand('reactiveThemes.createRuleFromCurrentFile', async () => {
		await createRuleFromCurrentFile();
	});

	// command: manage rules
	const manageRulesCommand = vscode.commands.registerCommand('reactiveThemes.manageRules', async () => {
		await manageRules();
	});

	// command: cleanup duplicate rules
	const cleanupRulesCommand = vscode.commands.registerCommand('reactiveThemes.cleanupDuplicates', async () => {
		await cleanupDuplicateRules();
	});

	// command: test rule
	const testRuleCommand = vscode.commands.registerCommand('reactiveThemes.testRule', async () => {
		await testRule();
	});

	// command: lint rules
	const lintRulesCommandRegistration = vscode.commands.registerCommand('reactiveThemes.lintRules', async () => {
		await lintRulesCommand();
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

	// listen for reactiveThemes.* config changes & reload
	const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
		if (event.affectsConfiguration('reactiveThemes')) {
			const config = loadConfig();
			if (themeManager) {
				themeManager.setDebounceMs(config.debounceMs);
				await themeManager.setEnabled(config.enabled);
			}

			// re-register timer rules when config changes
			if (timerTrigger) {
				timerTrigger.registerTimerRules(config.rules);
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
		createRuleCommand,
		manageRulesCommand,
		cleanupRulesCommand,
		testRuleCommand,
		lintRulesCommandRegistration,
		editorChangeListener,
		languageChangeListener,
		configChangeListener,
		themeManager
	);

	// register triggers for cleanup
	if (contextManager) {
		context.subscriptions.push(contextManager);
	}
	if (debugTrigger) {
		context.subscriptions.push(debugTrigger);
	}
	if (timerTrigger) {
		context.subscriptions.push(timerTrigger);
	}
	if (viewTrigger) {
		context.subscriptions.push(viewTrigger);
	}
	if (testTrigger) {
		context.subscriptions.push(testTrigger);
	}

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

	// get current context
	const currentContext = contextManager?.getContext() || {};

	// evaluate rules against current editor and context
	const result = evaluateRules(config.rules, editor, currentContext);

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
export async function deactivate() {
	console.log('[Reactive Themes] Extension deactivating...');

	// restore original theme on deactivation
	if (themeManager) {
		await themeManager.restoreOriginalTheme();
	}
}
