export interface CompositionSources {
    system_prompt: number;
    tools_schema: number;
    messages_user: number;
    messages_assistant: number;
    messages_tool_use: number;
    messages_tool_result: number;
    messages_thinking: number;
}
export interface CompositionPoint {
    turnId: number;
    capturedAt: string;
    requestId: string | null;
    total: number;
    sources: CompositionSources;
}
export declare function parseCaptures(outDir: string): Promise<Record<string, CompositionPoint[]>>;
//# sourceMappingURL=captures-parser.d.ts.map