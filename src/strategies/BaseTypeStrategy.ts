import * as vscode from 'vscode';
import { ReactiveStrategy } from './ReactiveStrategy';

export abstract class BaseTypeStrategy implements ReactiveStrategy {
    protected abstract keywords: Set<string>;
    
    // Cache: UriString -> { version, ranges }
    private cache = new Map<string, { version: number, ranges: vscode.Range[] }>();

    abstract shouldProcess(document: vscode.TextDocument): boolean;

    async getRanges(document: vscode.TextDocument, token: vscode.CancellationToken, changes?: vscode.TextDocumentContentChangeEvent[]): Promise<vscode.Range[]> {
        const key = document.uri.toString();
        const cached = this.cache.get(key);

        let rangesToKeep: vscode.Range[] = [];
        let dirtyRanges: vscode.Range[] = [];

        // CASE 1: Full Scan needed (No cache or no changes provided)
        if (!cached || !changes || (cached.version !== document.version - 1 && cached.version !== document.version)) {
            console.log(`[${this.constructor.name}] Full Scan for ${key}`);
            dirtyRanges = [new vscode.Range(0, 0, document.lineCount, 0)];
        } 
        // CASE 2: Incremental Update
        else {
            console.log(`[${this.constructor.name}] Incremental Update for ${key} (${changes.length} changes)`);
            
            // 1. Shift existing ranges
            rangesToKeep = this.shiftRanges(cached.ranges, changes);
            
            // 2. Identify dirty regions
            for (const change of changes) {
                const startLine = change.range.start.line;
                const linesAdded = (change.text.match(/\n/g) || []).length;
                const endLine = startLine + linesAdded;
                
                dirtyRanges.push(new vscode.Range(
                    Math.max(0, startLine - 1), 0,
                    Math.min(document.lineCount, endLine + 2), 0
                ));
            }
        }
        
        // 3. Scan identifiers in dirty regions
        const candidates = this.findIdentifiersInRanges(document, dirtyRanges, token);
        
        // 4. Hover check only new candidates
        const newConfirmedRanges = await this.checkCandidates(document, candidates, token);
        
        // 5. Merge
        const merged = [...rangesToKeep, ...newConfirmedRanges];
        
        this.cache.set(key, { version: document.version, ranges: merged });
        return merged;
    }

    private shiftRanges(oldRanges: vscode.Range[], changes: vscode.TextDocumentContentChangeEvent[]): vscode.Range[] {
        let ranges = [...oldRanges];
         
        for (const change of changes) {
            const nextRanges: vscode.Range[] = [];
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesDelta = (change.text.match(/\n/g) || []).length - (endLine - startLine);
            
            for (const r of ranges) {
                // If range is strictly before change, keep it.
                if (r.end.isBefore(change.range.start)) {
                    nextRanges.push(r);
                }
                // If range is strictly after change (and not touching), shift it.
                else if (r.start.isAfter(change.range.end)) {
                    if (linesDelta !== 0) {
                        nextRanges.push(new vscode.Range(
                            r.start.line + linesDelta, r.start.character,
                            r.end.line + linesDelta, r.end.character
                        ));
                    } else {
                        // Same line shift logic
                        if (r.start.line > endLine) {
                            nextRanges.push(r);
                        } else {
                            // On the same line as the end of the change.
                            const charDelta = change.text.length - change.rangeLength;
                             nextRanges.push(new vscode.Range(
                                r.start.line, r.start.character + charDelta,
                                r.end.line, r.end.character + charDelta
                            ));
                        }
                    }
                }
            }
            ranges = nextRanges;
        }
        return ranges;
    }

    private findIdentifiersInRanges(document: vscode.TextDocument, ranges: vscode.Range[], token: vscode.CancellationToken): { name: string, range: vscode.Range }[] {
        const text = document.getText(); 
        const identifiers: { name: string, range: vscode.Range }[] = [];
        
        const identifierPattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        const ignored = new Set([
            'import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'interface', 
            'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 
            'new', 'this', 'super', 'true', 'false', 'null', 'undefined', 'void', 'any', 
            'string', 'number', 'boolean', 'async', 'await', 'try', 'catch', 'throw', 
            'implements', 'extends', 'public', 'private', 'protected', 'readonly', 'static',
            'package', 'console', 'log' 
        ]);
        
        for (const scope of ranges) {
            if (token.isCancellationRequested) {break;}
            
            const offset = document.offsetAt(scope.start);
            const endOffset = document.offsetAt(scope.end);
            const slice = text.slice(offset, endOffset);
            
            let match;
            while ((match = identifierPattern.exec(slice))) {
                const name = match[0];
                if (ignored.has(name)) {continue;}

                const matchOffset = offset + match.index;
                const startPos = document.positionAt(matchOffset);
                const endPos = document.positionAt(matchOffset + name.length);
                
                identifiers.push({ name, range: new vscode.Range(startPos, endPos) });
            }
        }
        return identifiers;
    }

    private async checkCandidates(document: vscode.TextDocument, matches: { name: string, range: vscode.Range }[], token: vscode.CancellationToken): Promise<vscode.Range[]> {
        const ranges: vscode.Range[] = [];
        const BATCH_SIZE = 50; 
        
        for (let i = 0; i < matches.length; i += BATCH_SIZE) {
            if (token.isCancellationRequested) {return [];}
            
            const batch = matches.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (m) => {
                if (token.isCancellationRequested) {return null;}

                try {
                    const hovers: vscode.Hover[] = await vscode.commands.executeCommand(
                        'vscode.executeHoverProvider',
                        document.uri,
                        m.range.start
                    );

                    if (!hovers || hovers.length === 0) {return null;}

                    for (const hover of hovers) {
                        for (const content of hover.contents) {
                            const str = typeof content === 'string' ? content : content.value;
                            if (this.containsReactiveType(str)) {
                                return m.range;
                            }
                        }
                    }
                } catch (e) { }
                return null;
            });

            const results = await Promise.all(promises);
            for (const r of results) {
                if (r) {ranges.push(r);}
            }
        }
        return ranges;
    }

    protected containsReactiveType(hoverText: string): boolean {
        // Filter out function definitions
        if (/^\s*(?:\(method\)|function|const\s+\w+\s*:\s*\([^)]*\)\s*=>)/.test(hoverText) || hoverText.includes('function ')) {
            if (!hoverText.includes(':')) {return false;} // Simple check: usually vars have colon
        }

        for (const keyword of this.keywords) {
            const typePattern = new RegExp(`[:<]\\s*${keyword}(?:<|\\s|$)`, 'i');
            const asPattern = new RegExp(`\\bas\\s+${keyword}\\b`, 'i');
            
            if (typePattern.test(hoverText) || asPattern.test(hoverText)) {
                return true;
            }
        }
        return false;
    }
}
