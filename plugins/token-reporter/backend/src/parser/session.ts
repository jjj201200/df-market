import fs from 'fs';
import os from 'os';
import path from 'path';
import type { SessionInfo } from './types.js';
import { readFirstLineMeta } from './metadata.js';

export function findJSONLPath(sessionId: string): string | null {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  for (const proj of fs.readdirSync(projectsDir)) {
    const projPath = path.join(projectsDir, proj);
    if (!fs.statSync(projPath).isDirectory()) continue;

    const direct = path.join(projPath, sessionId + '.jsonl');
    if (fs.existsSync(direct)) return direct;

    const sub = path.join(projPath, 'subagents');
    if (fs.existsSync(sub)) {
      for (const f of fs.readdirSync(sub)) {
        if (f === sessionId + '.jsonl') return path.join(sub, f);
      }
    }
  }
  return null;
}

export function listSessions(): SessionInfo[] {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const sessions = new Map<string, SessionInfo>();

  function scanDir(dir: string) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fp);
      } catch {
        continue;
      }
      if (stat.isDirectory() && f === 'subagents') {
        scanDir(fp);
      } else if (f.endsWith('.jsonl')) {
        const sessionId = f.replace('.jsonl', '');
        if (!sessions.has(sessionId)) {
          const meta = readFirstLineMeta(fp);
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
      if (fs.statSync(projPath).isDirectory()) scanDir(projPath);
    } catch {}
  }

  return Array.from(sessions.values()).sort((a, b) => b.mtime.localeCompare(a.mtime));
}
