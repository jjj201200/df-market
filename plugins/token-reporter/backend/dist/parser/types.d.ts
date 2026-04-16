export interface SessionInfo {
    sessionId: string;
    slug: string;
    customTitle: string;
    gitBranch: string;
    projectDir: string;
    filePath: string;
    mtime: string;
}
export interface SessionData {
    sessionId: string;
    slug: string;
    gitBranch: string;
    turns: Turn[];
    systemEvents: SystemEvent[];
    hooks: HookEvent[];
    stopReasons: Record<string, number>;
    cacheTtl: {
        ephemeral1h: number;
        ephemeral5m: number;
    };
    subagents: Record<string, SubagentStats>;
}
export interface Turn {
    id: number;
    type: 'turn';
    time: string;
    timestamp: string;
    userText: string;
    assistantText: string;
    model: string;
    isSidechain: boolean;
    agentId: string | null;
    input: number;
    output: number;
    cacheR: number;
    cacheC: number;
    thinking: string | null;
    tools: Tool[];
}
export interface Tool {
    name: string;
    cls: string;
    params: string;
    inputArgs: InputArg[];
    status: 'ok' | 'err';
    isErr: boolean;
    startTime: string;
    endTime: string | null;
    dur: string;
    retContent: string;
    retSize: string;
    retLines: string;
    mcp: {
        server: string;
        method: string;
    } | null;
}
export interface InputArg {
    k: string;
    v: string;
    vc: string;
}
export type SystemEvent = {
    type: 'command';
    kind: 'slash' | 'bash';
    command: string;
    message: string;
    output: string;
    isError: boolean;
    timestamp: string;
    time: string;
} | {
    type: 'compact';
    trigger: string;
    preTokens: number;
    timestamp: string;
    time: string;
};
export interface HookEvent {
    hookName: string;
    hookEvent: string;
    durationMs: number;
    exitCode: number;
    stdout: string;
    stderr: string;
    timestamp: string;
}
export interface SubagentStats {
    agentId: string;
    agentType: string;
    description: string;
    totalTurns: number;
    totalTokens: {
        input: number;
        output: number;
        cacheR: number;
        cacheC: number;
    };
    toolCounts: Record<string, number>;
    turns: Turn[];
}
export interface JSONLRecord {
    type?: string;
    subtype?: string;
    uuid?: string;
    parentUuid?: string;
    sessionId?: string;
    slug?: string;
    gitBranch?: string;
    timestamp?: string;
    agentId?: string;
    isSidechain?: boolean;
    message?: {
        model?: string;
        usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_creation?: {
                ephemeral_1h_input_tokens?: number;
                ephemeral_5m_input_tokens?: number;
            };
            stop_reason?: string;
        };
        content?: Array<{
            type: string;
            text?: string;
            thinking?: string;
            id?: string;
            name?: string;
            input?: Record<string, unknown>;
            tool_use_id?: string;
            content?: string | Array<{
                type: string;
                text?: string;
            }>;
            is_error?: boolean;
        }>;
    };
    content?: string;
    compactMetadata?: {
        trigger?: string;
        preTokens?: number;
    };
    attachment?: {
        type?: string;
        hookName?: string;
        hookEvent?: string;
        durationMs?: number;
        exitCode?: number;
        stdout?: string;
        stderr?: string;
    };
}
//# sourceMappingURL=types.d.ts.map