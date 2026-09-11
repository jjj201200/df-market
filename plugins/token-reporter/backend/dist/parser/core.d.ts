import type { SessionData } from './types.js';
export interface ParseProgress {
    /** bytes consumed so far */
    bytes: number;
    /** total file size in bytes */
    total: number;
}
/**
 * Parse a session JSONL file.
 * onProgress fires during the streaming line-read phase (roughly the whole
 * parse for large files), throttled to ~2% steps; heavy single lines may
 * delay it slightly. The post-read assembly phase is synchronous and emits
 * no progress.
 */
export declare function parseSession(filePath: string, onProgress?: (p: ParseProgress) => void): Promise<SessionData | null>;
//# sourceMappingURL=core.d.ts.map