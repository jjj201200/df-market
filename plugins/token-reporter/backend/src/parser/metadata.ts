import fs from 'fs';
import path from 'path';

export interface FirstLineMeta {
  slug?: string;
  gitBranch?: string;
  customTitle?: string;
}

export function readFirstLineMeta(filePath: string): FirstLineMeta {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let slug = '';
    let gitBranch = '';
    let customTitle = '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        if (!slug && obj.slug) slug = String(obj.slug);
        if (!gitBranch && obj.gitBranch) gitBranch = String(obj.gitBranch);
        if (obj.type === 'custom-title' && obj.customTitle) {
          customTitle = String(obj.customTitle);
        }
      } catch {}
    }
    return { slug, gitBranch, customTitle };
  } catch {
    return {};
  }
}

export function loadSubagentMeta(
  sessionDir: string,
  agentId: string,
): { agentType: string; description: string } | null {
  const metaPath = path.join(sessionDir, 'subagents', `agent-${agentId}.meta.json`);
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { agentType: string; description: string };
    }
  } catch {}
  return null;
}
