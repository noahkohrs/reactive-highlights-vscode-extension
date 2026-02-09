import * as vscode from 'vscode';
import { ReactiveStrategy } from './strategies/ReactiveStrategy';
import { AngularStrategy } from './strategies/AngularStrategy';
import { VueStrategy } from './strategies/VueStrategy';

export class HighlightManager {
    private activeEditor: vscode.TextEditor | undefined;
    private strategies: ReactiveStrategy[];
    private decorationType: vscode.TextEditorDecorationType | undefined;
    private timeout: NodeJS.Timeout | undefined;
    private pendingChanges: vscode.TextDocumentContentChangeEvent[] = [];
    private activeUpdateTokenSource: vscode.CancellationTokenSource | undefined;
    private debounceTime: number = 100;

    constructor() {
        this.strategies = [
            new AngularStrategy(),
            new VueStrategy()
        ];
        this.activeEditor = vscode.window.activeTextEditor;
        this.updateConfig();
    }

    public activate(context: vscode.ExtensionContext) {
        // Initial update
        if (this.activeEditor) {
            this.triggerUpdate();
        }

        // Listeners
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('reactiveHighlights')) {
                    this.updateConfig();
                    this.triggerUpdate();
                }
            }),

            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.activeEditor = editor;
                if (editor) {
                    this.triggerUpdate();
                }
            }),

            vscode.workspace.onDidChangeTextDocument(event => {
                if (this.activeEditor && event.document === this.activeEditor.document) {
                    this.triggerUpdate(event.contentChanges);
                }
            })
        );
    }

    public dispose() {
        if (this.decorationType) {
            this.decorationType.dispose();
        }
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }

    private updateConfig() {
        if (this.decorationType) {
            this.decorationType.dispose();
        }

        const config = vscode.workspace.getConfiguration('reactiveHighlights');
        const color = config.get<string>('color') || '#A020F0';
        
        const enableBackground = config.get<boolean>('enableBackground') || false;
        const backgroundColor = config.get<string>('backgroundColor') || 'rgba(160, 32, 240, 0.2)';
        
        const enableBold = config.get<boolean>('enableBold') || false;
        const enableItalic = config.get<boolean>('enableItalic') || false;
        const enableUnderline = config.get<boolean>('enableUnderline') || false;

        this.debounceTime = config.get<number>('debounceTime') || 100;

        this.decorationType = vscode.window.createTextEditorDecorationType({
            color: color,
            backgroundColor: enableBackground ? backgroundColor : undefined,
            fontWeight: enableBold ? 'bold' : undefined,
            fontStyle: enableItalic ? 'italic' : undefined,
            textDecoration: enableUnderline ? 'underline' : undefined
        });
    }

    private triggerUpdate(changes?: readonly vscode.TextDocumentContentChangeEvent[]) {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        if (changes) {
            this.pendingChanges.push(...changes);
        } else {
            // If full update is requested (no changes passed), clear pending to force clean start?
            // Or just treat as "reset"?
            // If we are switching editors, we want a full scan.
            this.pendingChanges = []; 
        }

        // Debounce
        this.timeout = setTimeout(() => {
            // If we have accumulated changes, pass them.
            // If pendingChanges is empty, it means either:
            // 1. We called triggerUpdate without changes (explicit full scan)
            // 2. We just cleared it.
            // However, the distinction between "Full Scan" and "Incremental with empty changes" is important.
            // BaseTypeStrategy takes `changes?: ...`. If undefined -> Full Scan.
            
            const changesToPass = (changes || this.pendingChanges.length > 0) 
                ? [...this.pendingChanges] 
                : undefined;

            this.updateDecorations(changesToPass);
            
            this.pendingChanges = [];
            this.timeout = undefined;
        }, this.debounceTime);
    }

    private async updateDecorations(changes?: vscode.TextDocumentContentChangeEvent[]) {
        if (!this.activeEditor || !this.decorationType) {
            return;
        }

        // Cancel previous
        if (this.activeUpdateTokenSource) {
            this.activeUpdateTokenSource.cancel();
        }
        this.activeUpdateTokenSource = new vscode.CancellationTokenSource();
        const token = this.activeUpdateTokenSource.token;

        const document = this.activeEditor.document;
        const applicableStrategies = this.strategies.filter(s => s.shouldProcess(document));

        if (applicableStrategies.length === 0) {
            this.activeEditor.setDecorations(this.decorationType, []);
            return;
        }

        const allRanges: vscode.Range[] = [];

        try {
            const promiseResults = await Promise.allSettled(
                applicableStrategies.map(s => s.getRanges(document, token, changes))
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

            this.activeEditor.setDecorations(this.decorationType, allRanges);
        } catch (err) {
            console.error('Error updating decorations:', err);
        }
    }
}
