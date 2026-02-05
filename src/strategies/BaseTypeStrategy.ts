import * as vscode from 'vscode';
import { ReactiveStrategy } from './ReactiveStrategy';

export abstract class BaseTypeStrategy implements ReactiveStrategy {
    protected abstract keywords: Set<string>;
    
    // Cache to store the results of variables at specific positions/versions might be too complex due to edits moving things.
    // simpler cache: "variableName" -> boolean. 
    // BUT: "count" might be a signal in one scope and a number in another.
    // Caching by definition location is ideal but we initially don't have it.
    // For now, no complex caching to ensure correctness. We rely on VS Code's speed.

    abstract shouldProcess(document: vscode.TextDocument): boolean;

    async getRanges(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.Range[]> {
        const text = document.getText();
        const ranges: vscode.Range[] = [];
        
        // Find all identifiers that *could* be variables
        // We match words, but we should skip language keywords to save time.
        // Simple regex for identifiers
        const identifierPattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        
        // Common JS/TS preserved words to skip (incomplete list but helps performance)
        const ignored = new Set([
            'import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'interface', 
            'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 
            'new', 'this', 'super', 'true', 'false', 'null', 'undefined', 'void', 'any', 
            'string', 'number', 'boolean', 'async', 'await', 'try', 'catch', 'throw', 
            'implements', 'extends', 'public', 'private', 'protected', 'readonly', 'static',
            'package', 'console', 'log' 
        ]);

        const matches: { name: string, range: vscode.Range }[] = [];
        let match;
        
        // 1. Collect all candidates
        while ((match = identifierPattern.exec(text))) {
            if (token.isCancellationRequested) return [];
            
            const name = match[0];
            if (ignored.has(name)) continue;
            // Also skip if it starts with a capital letter? No, signals might be UpperCamelCase.
            // Skip clearly non-variable things? 
            
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + name.length);
            const range = new vscode.Range(startPos, endPos);
            
            matches.push({ name, range });
        }

        // 2. Limit the number of checks per update to prevent freezing
        // Only checking visible ranges would be better but we don't have access to visible ranges easily in this context without activeEditor reference.
        // But getRanges is called in context of activeEditor.
        
        // Optimization: Deduplicate? 
        // If "count" appears 50 times, we don't want to hover it 50 times.
        // But "count" in function A is different from "count" in function B.
        // We MUST check context.

        // BATCH PROCESSING
        const BATCH_SIZE = 20; 
        for (let i = 0; i < matches.length; i += BATCH_SIZE) {
            if (token.isCancellationRequested) return [];
            
            const batch = matches.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (m) => {
                if (token.isCancellationRequested) return null;

                try {
                    // Execute Hover Provider
                    const hovers: vscode.Hover[] = await vscode.commands.executeCommand(
                        'vscode.executeHoverProvider',
                        document.uri,
                        m.range.start
                    );

                    if (!hovers || hovers.length === 0) return null;

                    // Check contents of hover
                    for (const hover of hovers) {
                        for (const content of hover.contents) {
                            const str = typeof content === 'string' ? content : content.value;
                            if (this.containsReactiveType(str)) {
                                return m.range;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore errors
                }
                return null;
            });

            const results = await Promise.all(promises);
            for (const r of results) {
                if (r) ranges.push(r);
            }
            
            // Yield to event loop briefly?
            // await new Promise(r => setTimeout(r, 0)); 
            // This slows it down significantly but keeps UI responsive.
        }

        return ranges;
    }

    protected containsReactiveType(hoverText: string): boolean {
        // Check if any keyword exists in the hover text.
        // Naive check: match exact word boundaries? 
        // Hover text often mimics TS declaration: "const x: WritableSignal<number>"
        for (const keyword of this.keywords) {
            // We search for "keyword<" or ": keyword" or "keyword " to be safer?
            // "Signal" appears in "SignalOptions". 
            // "Ref" appears in "ReferenceError".
            // So we want explicit type usage.
            
            // Regex to match "Signal<" or "Signal" as a whole word type
            const regex = new RegExp(`\\b${keyword}\\b(?:<)?`, 'i'); // case insensitive? signals are usually PascalCase types.
            if (regex.test(hoverText)) return true;
        }
        return false;
    }
}
