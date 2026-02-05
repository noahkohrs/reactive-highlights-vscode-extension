import * as vscode from 'vscode';
import { BaseTypeStrategy } from './BaseTypeStrategy';

export class VueStrategy extends BaseTypeStrategy {
    protected keywords = new Set([
        'Ref', 
        'ComputedRef', 
        'WritableComputedRef', 
        'ShallowRef',
        'ToRef',
        'ToRefs' // this returns an object of refs
    ]);
    
    // Note: 'reactive()' returns the object itself (proxy), so hover text usually matches the interface/class, not "Reactive<T>".
    // Identifying 'reactive' objects purely by type is difficult without deeper analysis.

    shouldProcess(document: vscode.TextDocument): boolean {
        return document.languageId === 'typescript' || document.languageId === 'javascript' || document.languageId === 'vue';
    }
}
