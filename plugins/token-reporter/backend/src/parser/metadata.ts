import fs from 'fs';
import path from 'path';

export interface FirstLineMeta {
  slug?: string;
  gitBranch?: string;
  customTitle?: string;
}

/** Block size read from each end of the file when extracting meta (64KB) */
const BLOCK = 64 * 1024;

function readBlock(fd: number, size: number, fromEnd: boolean): string {
  const len = Math.min(BLOCK, size);
  const buf = Buffer.alloc(len);
  if (fromEnd) {
    fs.readSync(fd, buf, 0, len, size - len);
  } else {
    fs.readSync(fd, buf, 0, len, 0);
  }
  return buf.toString('utf8');
}

/**
 * Extract session meta (slug / gitBranch / customTitle) by reading only the
 * HEAD and TAIL of the file — O(1) regardless of file size. The old
 * implementation read the whole file and JSON.parsed every line, costing
 * seconds per multi-hundred-MB session.
 *
 * - slug/gitBranch come from the first record, which sits at the head.
 * - custom-title records are appended by Claude Code when the user renames a
 *   session, so the latest one lives near the tail; the tail block is scanned
 *   backwards and the newest match wins.
 */
export function readFirstLineMeta(filePath: string): FirstLineMeta {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;

    let slug = '';
    let gitBranch = '';
    let customTitle = '';

    // Head block: scan forward until all three fields are found
    const head = readBlock(fd, size, false);
    for (const line of head.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        if (!slug && obj.slug) slug = String(obj.slug);
        if (!gitBranch && obj.gitBranch) gitBranch = String(obj.gitBranch);
        if (obj.type === 'custom-title' && obj.customTitle) {
          customTitle = String(obj.customTitle);
        }
      } catch {}
      if (slug && gitBranch && customTitle) break;
    }

    // Tail block: newest custom-title wins — scan backwards
    if (!customTitle && size > BLOCK) {
      const tail = readBlock(fd, size, true);
      const lines = tail.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!;
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as Record<string, unknown>;
          if (obj.type === 'custom-title' && obj.customTitle) {
            customTitle = String(obj.customTitle);
            break;
          }
        } catch {}
      }
    }

    return {slug, gitBranch, customTitle};
  } catch {
    return {};
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

export function loadSubagentMeta(
  sessionDir: string,
  agentId: string,
): {agentType: string; description: string} | null {
  const metaPath = path.join(sessionDir, 'subagents', `agent-${agentId}.meta.json`);
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {agentType: string; description: string};
    }
  } catch {
    return null;
  }
  return null;
}
