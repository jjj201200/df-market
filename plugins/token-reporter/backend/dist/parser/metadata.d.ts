export interface FirstLineMeta {
    slug?: string;
    gitBranch?: string;
    customTitle?: string;
}
/**
 * Extract session meta (slug / gitBranch / customTitle) by reading only the
 * HEAD and TAIL of the file — O(1) regardless of file size. The old
 * implementation read the whole file and JSON.parsed every line, costing
 * seconds per multi-hundred-MB session.
 *
 * - slug/gitBranch come from the first record, which sits at the head.
 * - custom-title records are appended by Claude Code when the user renames a
 *   session, so the latest one lives near the tail; the tail block is scanned
 *   backwards and the newest match wins.
 */
export declare function readFirstLineMeta(filePath: string): FirstLineMeta;
export declare function loadSubagentMeta(sessionDir: string, agentId: string): {
    agentType: string;
    description: string;
} | null;
//# sourceMappingURL=metadata.d.ts.map