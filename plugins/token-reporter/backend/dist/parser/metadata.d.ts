export interface FirstLineMeta {
    slug?: string;
    gitBranch?: string;
    customTitle?: string;
}
export declare function readFirstLineMeta(filePath: string): FirstLineMeta;
export declare function loadSubagentMeta(sessionDir: string, agentId: string): {
    agentType: string;
    description: string;
} | null;
//# sourceMappingURL=metadata.d.ts.map