export declare function parseSlashCommandContent(content: unknown): {
    command: string;
    message: string;
} | null;
export declare function parseLocalCommandStdout(content: unknown): string | null;
export declare function isLocalCommandCaveat(content: unknown): boolean;
export declare function parseBashInputContent(content: unknown): string | null;
export declare function parseBashOutputContent(content: unknown): {
    stdout: string;
    stderr: string;
} | null;
export declare function isSlashCommandWrapperContent(content: unknown): boolean;
//# sourceMappingURL=content.d.ts.map