import fs from 'fs';
import os from 'os';
import path from 'path';
import { readFirstLineMeta } from './metadata.js';
export function findJSONLPath(sessionId) {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir))
        return null;
    for (const proj of fs.readdirSync(projectsDir)) {
        const projPath = path.join(projectsDir, proj);
        if (!fs.statSync(projPath).isDirectory())
            continue;
        const direct = path.join(projPath, sessionId + '.jsonl');
        if (fs.existsSync(direct))
            return direct;
        const sub = path.join(projPath, 'subagents');
        if (fs.existsSync(sub)) {
            for (const f of fs.readdirSync(sub)) {
                if (f === sessionId + '.jsonl')
                    return path.join(sub, f);
            }
        }
    }
    return null;
}
/**
 * mtime cache for per-file meta extraction. listSessions runs on every
 * /api/sessions call — including the SSE-triggered quiet refresh after each
 * tool call — so an unchanged file must not be re-parsed (its positional
 * head/tail read is cheap, but 80 files still add up; more importantly this
 * keeps behavior O(changed files), not O(all files)).
 */
const metaCache = new Map();
function cachedFirstLineMeta(fp, stat) {
    const hit = metaCache.get(fp);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
        return hit.meta;
    }
    const meta = readFirstLineMeta(fp);
    metaCache.set(fp, { mtimeMs: stat.mtimeMs, size: stat.size, meta });
    return meta;
}
export function listSessions() {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir))
        return [];
    const sessions = new Map();
    function scanDir(dir) {
        for (const f of fs.readdirSync(dir)) {
            const fp = path.join(dir, f);
            let stat;
            try {
                stat = fs.statSync(fp);
            }
            catch {
                continue;
            }
            if (stat.isDirectory() && f === 'subagents') {
                scanDir(fp);
            }
            else if (f.endsWith('.jsonl')) {
                const sessionId = f.replace('.jsonl', '');
                if (!sessions.has(sessionId)) {
                    const meta = cachedFirstLineMeta(fp, stat);
                    sessions.set(sessionId, {
                        sessionId,
                        slug: meta.slug || sessionId,
                        customTitle: meta.customTitle || '',
                        gitBranch: meta.gitBranch || '',
                        projectDir: path.basename(dir),
                        filePath: fp,
                        mtime: stat.mtime.toISOString(),
                    });
                }
            }
        }
    }
    for (const proj of fs.readdirSync(projectsDir)) {
        const projPath = path.join(projectsDir, proj);
        try {
            if (fs.statSync(projPath).isDirectory())
                scanDir(projPath);
        }
        catch { }
    }
    return Array.from(sessions.values()).sort((a, b) => b.mtime.localeCompare(a.mtime));
}
