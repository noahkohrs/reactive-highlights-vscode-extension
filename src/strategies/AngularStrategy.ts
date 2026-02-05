import * as vscode from 'vscode';
import { BaseTypeStrategy } from './BaseTypeStrategy';

export class AngularStrategy extends BaseTypeStrategy {
    protected keywords = new Set([
        'Signal', 
        'WritableSignal', 
        'InputSignal', 
        'ModelSignal',
        'Computed' // Sometimes just Computed? usually Signal<T>
    ]);

    shouldProcess(document: vscode.TextDocument): boolean {
        return document.languageId === 'typescript';
    }
}
