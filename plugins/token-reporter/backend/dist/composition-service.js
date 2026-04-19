import fs from 'fs';
import { parseCaptures } from './captures-parser.js';
import { isHookStale } from './audit-settings.js';
function charsToTokens(n) { return Math.round(n / 4); }
async function estimatedFromTurns(sessionId, fallback) {
    const turns = await fallback(sessionId);
    return turns.map((t) => {
        const sources = {
            system_prompt: 0,
            tools_schema: 0,
            messages_user: charsToTokens(t.userText.length),
            messages_assistant: charsToTokens(t.assistantText.length),
            messages_tool_use: charsToTokens(t.toolUseJson.length),
            messages_tool_result: charsToTokens(t.toolResultText.length),
            messages_thinking: charsToTokens(t.thinkingText.length),
        };
        const total = Object.values(sources).reduce((a, b) => a + b, 0);
        return { turnId: t.turnId, capturedAt: '', requestId: null, total, sources };
    });
}
export async function getComposition(sessionId, opts) {
    if (!opts.auditEnabled) {
        const points = await estimatedFromTurns(sessionId, opts.turnsFallback);
        return { source: 'estimated', points, unknownSources: ['system_prompt', 'tools_schema'] };
    }
    const stale = !fs.existsSync(opts.outDir) || isHookStale(opts.outDir);
    if (stale) {
        const points = await estimatedFromTurns(sessionId, opts.turnsFallback);
        return {
            source: 'estimated',
            points,
            unknownSources: ['system_prompt', 'tools_schema'],
            hookStale: true,
        };
    }
    const groups = await parseCaptures(opts.outDir);
    const live = groups[sessionId] || [];
    if (live.length > 0)
        return { source: 'live', points: live };
    // Audit is on, hook is fresh, but no captures exist for this session yet.
    const points = await estimatedFromTurns(sessionId, opts.turnsFallback);
    return { source: 'estimated', points, unknownSources: ['system_prompt', 'tools_schema'] };
}
