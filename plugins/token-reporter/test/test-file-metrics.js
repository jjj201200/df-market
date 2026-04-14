const assert = require('assert');

function getFilePath(tool) {
  const fp = tool.input.find((a) => a.k === 'file_path');
  return fp ? fp.v : '';
}

function hasOffsetLimit(tool) {
  return tool.input.some((a) => a.k === 'offset' || a.k === 'limit');
}

function getGrepPattern(tool) {
  const pat = tool.input.find((a) => a.k === 'pattern');
  return pat ? pat.v : '';
}

function getGrepGlob(tool) {
  const gl = tool.input.find((a) => a.k === 'glob');
  return gl ? gl.v : '';
}

function parseRetLines(retLines) {
  const n = parseInt(retLines.replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function computeFileMetrics(turns) {
  const readMap = new Map();
  const editSet = new Set();
  const bloatedGreps = [];

  for (const t of turns) {
    for (const tool of t.tools) {
      if (tool.cls === 'read') {
        const fp = getFilePath(tool);
        if (fp) {
          if (!readMap.has(fp)) {
            readMap.set(fp, { filePath: fp, readCount: 0, hasOffsetLimit: false, turnIds: [] });
          }
          const entry = readMap.get(fp);
          entry.readCount++;
          entry.turnIds.push(t.id);
          if (hasOffsetLimit(tool)) entry.hasOffsetLimit = true;
        }
      }
      if (tool.cls === 'edit' || tool.cls === 'write') {
        const fp = getFilePath(tool);
        if (fp) editSet.add(fp);
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
    bloatedGreps: bloatedGreps.slice(0, 10),
    unreadReads: unreadReads.slice(0, 10),
  };
}

const turns = [
  {
    id: 1,
    tools: [
      { cls: 'read', input: [{ k: 'file_path', v: '/src/app.ts' }], retLines: '0' },
      { cls: 'read', input: [{ k: 'file_path', v: '/src/app.ts' }], retLines: '0' },
      { cls: 'edit', input: [{ k: 'file_path', v: '/src/app.ts' }], retLines: '0' },
      { cls: 'grep', input: [{ k: 'pattern', v: 'function' }, { k: 'glob', v: '*.ts' }], retLines: '120' },
    ],
  },
  {
    id: 2,
    tools: [
      { cls: 'read', input: [{ k: 'file_path', v: '/src/utils.ts' }, { k: 'offset', v: '1' }], retLines: '0' },
      { cls: 'read', input: [{ k: 'file_path', v: '/src/app.ts' }], retLines: '0' },
      { cls: 'write', input: [{ k: 'file_path', v: '/src/new.ts' }], retLines: '0' },
    ],
  },
  {
    id: 3,
    tools: [
      { cls: 'read', input: [{ k: 'file_path', v: '/src/helper.ts' }], retLines: '0' },
      { cls: 'read', input: [{ k: 'file_path', v: '/src/helper.ts' }], retLines: '0' },
      { cls: 'grep', input: [{ k: 'pattern', v: 'class' }], retLines: '200' },
    ],
  },
];

const metrics = computeFileMetrics(turns);
assert.strictEqual(metrics.totalReadFiles, 3, 'totalReadFiles should be 3');
assert.strictEqual(metrics.totalEditFiles, 2, 'totalEditFiles should be 2');
assert.ok(Math.abs(metrics.readEditRatio - 1.5) < 0.001, 'readEditRatio should be 1.5');
assert.strictEqual(metrics.topReads.length, 3, 'topReads should have 3 entries');
assert.strictEqual(metrics.topReads[0].filePath, '/src/app.ts', 'top read should be /src/app.ts');
assert.strictEqual(metrics.topReads[0].readCount, 3, 'app.ts read count should be 3');
assert.strictEqual(metrics.topReads[0].hasOffsetLimit, false, 'app.ts hasOffsetLimit should be false');
assert.strictEqual(metrics.topReads[1].filePath, '/src/helper.ts', 'second top read should be /src/helper.ts');
assert.strictEqual(metrics.topReads[1].readCount, 2, 'helper.ts read count should be 2');
assert.strictEqual(metrics.topReads[2].hasOffsetLimit, true, 'utils.ts hasOffsetLimit should be true');
assert.strictEqual(metrics.bloatedGreps.length, 2, 'bloatedGreps should have 2 entries');
assert.strictEqual(metrics.bloatedGreps[0].retLines, 120, 'first bloated grep should have 120 lines');
assert.strictEqual(metrics.bloatedGreps[1].glob, '', 'second bloated grep glob should be empty');
assert.strictEqual(metrics.unreadReads.length, 1, 'unreadReads should have 1 entry');
assert.strictEqual(metrics.unreadReads[0].filePath, '/src/helper.ts', 'unread read should be helper.ts');

// Empty turns
const emptyMetrics = computeFileMetrics([]);
assert.strictEqual(emptyMetrics.totalReadFiles, 0);
assert.strictEqual(emptyMetrics.totalEditFiles, 0);
assert.strictEqual(emptyMetrics.topReads.length, 0);
assert.strictEqual(emptyMetrics.bloatedGreps.length, 0);
assert.strictEqual(emptyMetrics.unreadReads.length, 0);

// No reads/edits
const noFileTurns = [
  {
    id: 1,
    tools: [
      { cls: 'bash', input: [{ k: 'command', v: 'ls' }], retLines: '0' },
    ],
  },
];
const noFileMetrics = computeFileMetrics(noFileTurns);
assert.strictEqual(noFileMetrics.totalReadFiles, 0);
assert.strictEqual(noFileMetrics.totalEditFiles, 0);

console.log('All file metrics tests passed!');
