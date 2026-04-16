export interface IntegrationStatus {
    integrated: boolean;
    currentCommand: string;
    originalScript: boolean;
    hasStatusLine: boolean;
}
export interface IntegrationResult {
    success: boolean;
    message: string;
    status?: IntegrationStatus;
    originalPath?: string;
    error?: unknown;
}
export declare function getStatus(): IntegrationStatus;
export declare function enableIntegration(options?: {
    force?: boolean;
}): IntegrationResult;
export declare function disableIntegration(): IntegrationResult;
export declare function hasOriginalScript(): boolean;
//# sourceMappingURL=statusline-integration.d.ts.map