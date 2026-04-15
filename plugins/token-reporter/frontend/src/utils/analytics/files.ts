import type {TurnItem, ToolItem} from '../../types/state';

export interface FileReadEntry {
  filePath: string;
  readCount: number;
  hasOffsetLimit: boolean;
  turnIds: number[];
}

export interface FileMetrics {
  topReads: FileReadEntry[];
  readEditRatio: number;
  totalReadFiles: number;
  totalEditFiles: number;
  totalReadOps: number;
  totalEditOps: number;
  bloatedGreps: {pattern: string; glob: string; retLines: number; turnId: number}[];
  unreadReads: FileReadEntry[];
}

function getFilePath(tool: ToolItem): string {
  const fp = tool.input.find((a) => a.k === 'file_path');
  return fp ? fp.v : '';
}

function hasOffsetLimit(tool: ToolItem): boolean {
  return tool.input.some((a) => a.k === 'offset' || a.k === 'limit');
}

function getGrepPattern(tool: ToolItem): string {
  const pat = tool.input.find((a) => a.k === 'pattern');
  return pat ? pat.v : '';
}

function getGrepGlob(tool: ToolItem): string {
  const gl = tool.input.find((a) => a.k === 'glob');
  return gl ? gl.v : '';
}

function parseRetLines(retLines: string): number {
  const n = parseInt(retLines.replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

export function computeFileMetrics(turns: TurnItem[]): FileMetrics {
  const readMap = new Map<string, FileReadEntry>();
  const editSet = new Set<string>();
  const bloatedGreps: FileMetrics['bloatedGreps'] = [];
  let totalReadOps = 0;
  let totalEditOps = 0;

  for (const t of turns) {
    for (const tool of t.tools) {
      if (tool.cls === 'read') {
        const fp = getFilePath(tool);
        if (fp) {
          if (!readMap.has(fp)) {
            readMap.set(fp, {filePath: fp, readCount: 0, hasOffsetLimit: false, turnIds: []});
          }
          const entry = readMap.get(fp)!;
          entry.readCount++;
          entry.turnIds.push(t.id);
          if (hasOffsetLimit(tool)) entry.hasOffsetLimit = true;
          totalReadOps++;
        }
      }
      if (tool.cls === 'edit' || tool.cls === 'write') {
        const fp = getFilePath(tool);
        if (fp) {
          editSet.add(fp);
          totalEditOps++;
        }
      }
      if (tool.cls === 'grep') {
        const lines = parseRetLines(tool.retLines);
        if (lines > 100) {
          bloatedGreps.push({
            pattern: getGrepPattern(tool),
            glob: getGrepGlob(tool),
            retLines: lines,
            turnId: t.id,
          });
        }
      }
    }
  }

  const topReads = Array.from(readMap.values())
    .sort((a, b) => b.readCount - a.readCount)
    .slice(0, 20);

  const unreadReads = topReads.filter((r) => !editSet.has(r.filePath) && r.readCount >= 2);

  return {
    topReads,
    readEditRatio: editSet.size > 0 ? readMap.size / editSet.size : readMap.size,
    totalReadFiles: readMap.size,
    totalEditFiles: editSet.size,
    totalReadOps,
    totalEditOps,
    bloatedGreps: bloatedGreps.slice(0, 10),
    unreadReads: unreadReads.slice(0, 10),
  };
}
