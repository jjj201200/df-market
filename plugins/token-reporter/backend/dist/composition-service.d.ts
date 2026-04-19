import { type CompositionPoint, type CompositionSources } from './captures-parser.js';
export interface EstimatedTurn {
    turnId: number;
    userText: string;
    assistantText: string;
    toolUseJson: string;
    toolResultText: string;
    thinkingText: string;
}
export interface CompositionResponse {
    source: 'live' | 'estimated';
    points: CompositionPoint[];
    unknownSources?: Array<keyof CompositionSources>;
    hookStale?: boolean;
}
export interface GetCompositionOpts {
    outDir: string;
    auditEnabled: boolean;
    turnsFallback: (sessionId: string) => Promise<EstimatedTurn[]>;
}
export declare function getComposition(sessionId: string, opts: GetCompositionOpts): Promise<CompositionResponse>;
//# sourceMappingURL=composition-service.d.ts.map