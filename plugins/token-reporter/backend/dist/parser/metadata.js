import fs from 'fs';
import path from 'path';
export function readFirstLineMeta(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let slug = '';
        let gitBranch = '';
        let customTitle = '';
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const obj = JSON.parse(line);
                if (!slug && obj.slug)
                    slug = String(obj.slug);
                if (!gitBranch && obj.gitBranch)
                    gitBranch = String(obj.gitBranch);
                if (obj.type === 'custom-title' && obj.customTitle) {
                    customTitle = String(obj.customTitle);
                }
            }
            catch { }
        }
        return { slug, gitBranch, customTitle };
    }
    catch {
        return {};
    }
}
export function loadSubagentMeta(sessionDir, agentId) {
    const metaPath = path.join(sessionDir, 'subagents', `agent-${agentId}.meta.json`);
    try {
        if (fs.existsSync(metaPath)) {
            return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
    }
    catch { }
    return null;
}
