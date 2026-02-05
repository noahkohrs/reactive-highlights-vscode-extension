import * as vscode from 'vscode';

export interface ReactiveStrategy {
    /**
     * Determines if this strategy should apply to the given document.
     */
    shouldProcess(document: vscode.TextDocument): boolean;

    /**
     * returns the ranges that should be highlighted as "Reactive"
     */
    getRanges(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.Range[]>;
}
