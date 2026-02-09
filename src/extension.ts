// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HighlightManager } from './HighlightManager';

let highlightManager: HighlightManager;

export function activate(context: vscode.ExtensionContext) {
	console.log('Reactive Highlights extension activated.');
    
    highlightManager = new HighlightManager();
    highlightManager.activate(context);
}

export function deactivate() {
    if (highlightManager) {
        highlightManager.dispose();
    }
}

