// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AngularStrategy } from './strategies/AngularStrategy';
import { VueStrategy } from './strategies/VueStrategy';
import { ReactiveStrategy } from './strategies/ReactiveStrategy';

let activeEditor = vscode.window.activeTextEditor;

const strategies: ReactiveStrategy[] = [
	new AngularStrategy(),
	new VueStrategy()
];

let reactiveDecorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
	console.log('Reactive Highlights extension activated.');

    // Initialize decoration type based on configuration
    updateDecorationType();

	if (activeEditor) {
		triggerUpdateDecorations();
	}

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('reactiveHighlights')) {
            updateDecorationType();
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations(true);
		}
	}, null, context.subscriptions);
}

let timeout: NodeJS.Timeout | undefined = undefined;
function triggerUpdateDecorations(throttle = false) {
	if (timeout) {
		clearTimeout(timeout);
		timeout = undefined;
	}
	if (throttle) {
		timeout = setTimeout(updateDecorations, 500);
	} else {
		updateDecorations();
	}
}

function updateDecorationType() {
    if (reactiveDecorationType) {
        reactiveDecorationType.dispose();
    }
    
    const config = vscode.workspace.getConfiguration('reactiveHighlights');
    const color = config.get<string>('color') || '#A020F0';
    
    // Style options
    const enableBackground = config.get<boolean>('enableBackground') || false;
    const backgroundColor = config.get<string>('backgroundColor') || 'rgba(160, 32, 240, 0.2)';
    
    const enableBold = config.get<boolean>('enableBold') || false;
    const enableItalic = config.get<boolean>('enableItalic') || false;
    const enableUnderline = config.get<boolean>('enableUnderline') || false;

    reactiveDecorationType = vscode.window.createTextEditorDecorationType({
        color: color,
        backgroundColor: enableBackground ? backgroundColor : undefined,
        fontWeight: enableBold ? 'bold' : undefined,
        fontStyle: enableItalic ? 'italic' : undefined,
        textDecoration: enableUnderline ? 'underline' : undefined
    });
}

let activeUpdateTokenSource: vscode.CancellationTokenSource | undefined;

async function updateDecorations() {
	if (!activeEditor) {
		return;
	}
	
	// Cancel previous running update
    if (activeUpdateTokenSource) {
        activeUpdateTokenSource.cancel();
    }
    activeUpdateTokenSource = new vscode.CancellationTokenSource();
    const token = activeUpdateTokenSource.token;

	const document = activeEditor.document;
	const applicableStrategies = strategies.filter(s => s.shouldProcess(document));
	
	if (applicableStrategies.length === 0) {
		activeEditor.setDecorations(reactiveDecorationType, []);
		return;
	}

	const allRanges: vscode.Range[] = [];
	
	try {
        const promiseResults = await Promise.allSettled(
            applicableStrategies.map(s => s.getRanges(document, token))
        );

        if (token.isCancellationRequested) {
            return;
        }

        for (const result of promiseResults) {
            if (result.status === 'fulfilled') {
                allRanges.push(...result.value);
            } else {
                console.error('Strategy failed:', result.reason);
            }
        }
        
        activeEditor.setDecorations(reactiveDecorationType, allRanges);
    } catch (err) {
        console.error('Error updating decorations:', err);
    }
}

export function deactivate() {}
