import fs from 'fs';
import path from 'path';
import { parseSession } from './core.js';
import { loadSubagentMeta } from './metadata.js';
export async function parseSubagentFile(filePath) {
    const sessionData = await parseSession(filePath);
    if (!sessionData) {
        return {
            totalTurns: 0,
            totalTokens: { input: 0, output: 0, cacheR: 0, cacheC: 0 },
            toolCounts: {},
            turns: [],
        };
    }
    const toolCounts = {};
    for (const turn of sessionData.turns) {
        for (const tool of turn.tools || []) {
            toolCounts[tool.cls] = (toolCounts[tool.cls] || 0) + 1;
        }
    }
    const totalTokens = sessionData.turns.reduce((acc, t) => ({
        input: acc.input + (t.input || 0),
        output: acc.output + (t.output || 0),
        cacheR: acc.cacheR + (t.cacheR || 0),
        cacheC: acc.cacheC + (t.cacheC || 0),
    }), { input: 0, output: 0, cacheR: 0, cacheC: 0 });
    return {
        totalTurns: sessionData.turns.length,
        totalTokens,
        toolCounts,
        turns: sessionData.turns,
    };
}
export async function collectSubagentStats(sessionDir) {
    const subagentsDir = path.join(sessionDir, 'subagents');
    if (!fs.existsSync(subagentsDir)) {
        return {};
    }
    const subagents = new Map();
    const files = fs.readdirSync(subagentsDir);
    for (const f of files) {
        if (!f.startsWith('agent-') || !f.endsWith('.jsonl'))
            continue;
        const agentId = f.replace(/^agent-/, '').replace(/\.jsonl$/, '');
        if (!agentId)
            continue;
        const meta = loadSubagentMeta(sessionDir, agentId);
        const stats = await parseSubagentFile(path.join(subagentsDir, f));
        subagents.set(agentId, {
            agentId,
            agentType: meta?.agentType || 'Unknown',
            description: meta?.description || '',
            totalTurns: stats.totalTurns,
            totalTokens: stats.totalTokens,
            toolCounts: stats.toolCounts || {},
            turns: stats.turns || [],
        });
    }
    return Object.fromEntries(subagents);
}
