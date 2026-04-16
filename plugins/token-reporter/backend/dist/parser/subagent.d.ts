import type { SubagentStats } from './types.js';
export declare function parseSubagentFile(filePath: string): Promise<{
    totalTurns: number;
    totalTokens: {
        input: number;
        output: number;
        cacheR: number;
        cacheC: number;
    };
    toolCounts: Record<string, number>;
    turns: SubagentStats['turns'];
}>;
export declare function collectSubagentStats(sessionDir: string): Promise<Record<string, SubagentStats>>;
//# sourceMappingURL=subagent.d.ts.map