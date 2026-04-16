export declare function semverCompare(a: string, b: string): number;
export declare const MIGRATIONS: Array<[string, (config: Record<string, unknown>, dataDir: string) => Promise<void> | void]>;
export declare function migrate({ lastVersion, pluginVersion, config, dataDir, configPath, }: {
    lastVersion?: string;
    pluginVersion: string;
    config: Record<string, unknown>;
    dataDir: string;
    configPath: string;
}): Promise<void>;
//# sourceMappingURL=migrate.d.ts.map