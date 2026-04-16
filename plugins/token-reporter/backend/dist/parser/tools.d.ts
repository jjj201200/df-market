export declare function toolNameToCls(name: string): string;
export declare function parseMcpToolName(name: string): {
    server: string;
    method: string;
} | null;
export declare function buildInputArgs(toolName: string, input: Record<string, unknown>): {
    k: string;
    v: string;
    vc: string;
}[];
export declare function buildParamsSummary(toolName: string, input: Record<string, unknown>): string;
//# sourceMappingURL=tools.d.ts.map