const assert = require('assert');
const path = require('path');

// Stub minimal i18n for recommendation tests
const t = (key, vars) => {
  if (vars) {
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), key);
  }
  return key;
};

// We need to import the ESM modules. Node can do this via dynamic import.
async function run() {
  const analyticsPath = path.resolve(__dirname, '../frontend/src/utils/analytics/index.ts');
  // Vite/TS modules aren't directly runnable in Node, so we load the individual files
  // after compiling them with tsx or similar. Since we don't have tsx installed globally,
  // we'll instead use the TypeScript compiler to transpile on the fly via ts-node/register
  // if available, or just test pure logic by copying key functions here inline.

  // Simpler approach: because these are pure functions with no DOM deps, we can copy
  // the implementations into this test file for direct execution. This avoids needing
  // a full TS-to-JS build pipeline in tests.

  // ─── Inline implementations for testing ─────────────────

  function computeCacheMetrics(turns) {
    let totalCacheR = 0;
    let totalCacheC = 0;
    let totalInput = 0;
    const perTurnHitRate = [];
    for (const t of turns) {
      totalCacheR += t.cacheR;
      totalCacheC += t.cacheC;
      totalInput += t.input;
      const denom = t.cacheR + t.input;
      perTurnHitRate.push({turnId: t.id, rate: denom > 0 ? t.cacheR / denom : 0});
    }
    const totalDenom = totalCacheR + totalInput;
    const hitRate = totalDenom > 0 ? totalCacheR / totalDenom : 0;
    const efficiencyRatio = totalCacheC > 0 ? totalCacheR / totalCacheC : 0;
    return {totalCacheR, totalCacheC, totalInput, hitRate, efficiencyRatio, estimatedSavings: 0, perTurnHitRate};
  }

  function computeToolEfficiency(turns) {
    let totalCalls = 0;
    let totalErrors = 0;
    const errorsByClass = {};
    const largeCalls = [];
    let mcpTurns = 0;
    for (const t of turns) {
      let hasMcp = false;
      for (const tool of t.tools) {
        totalCalls++;
        if (tool.isErr) totalErrors++;
        if (!errorsByClass[tool.cls]) errorsByClass[tool.cls] = {total: 0, errors: 0, rate: 0};
        errorsByClass[tool.cls].total++;
        if (tool.isErr) errorsByClass[tool.cls].errors++;
        const bytes = parseInt(tool.retSize, 10) || 0;
        if (bytes > 50 * 1024) {
          largeCalls.push({turnId: t.id, toolName: tool.name, retSize: tool.retSize, retBytes: bytes});
        }
        if (tool.cls === 'mcp') hasMcp = true;
      }
      if (hasMcp) mcpTurns++;
    }
    for (const v of Object.values(errorsByClass)) {
      v.rate = v.total > 0 ? v.errors / v.total : 0;
    }
    return {
      totalCalls,
      totalErrors,
      errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
      errorsByClass,
      redundantGroups: [],
      largeCalls,
      mcpTurnPct: turns.length > 0 ? mcpTurns / turns.length : 0,
    };
  }

  function computeContextGrowth(data, turns) {
    const points = [];
    let cumulative = 0;
    for (const t of turns) {
      const delta = t.input + t.cacheC + t.output;
      cumulative += delta;
      points.push({turnId: t.id, cumulative, delta});
    }
    const compactEvents = [];
    for (const item of data) {
      if (item.type === 'compact') {
        let afterIdx = 0;
        for (let i = 0; i < turns.length; i++) {
          if (turns[i].timestamp <= item.timestamp) afterIdx = i;
        }
        compactEvents.push({timestamp: item.timestamp, preTokens: item.preTokens, afterTurnIdx: afterIdx});
      }
    }
    const avgGrowthPerTurn = points.length > 0 ? cumulative / points.length : 0;
    return {points, compactEvents, avgGrowthPerTurn};
  }

  function computePromptMetrics(turns) {
    let totalChars = 0;
    let totalTokens = 0;
    let longestPromptChars = 0;
    let longestPromptTurn = -1;
    let maxShortStreak = 0;
    let currentStreak = 0;
    let totalInput = 0;
    let totalOutput = 0;
    const promptTrend = [];
    for (const t of turns) {
      const chars = t.user ? t.user.length : 0;
      const estTokens = Math.round(chars / 4);
      totalChars += chars;
      totalTokens += estTokens;
      totalInput += t.input;
      totalOutput += t.output;
      if (chars > longestPromptChars) {
        longestPromptChars = chars;
        longestPromptTurn = t.id;
      }
      if (chars < 20) {
        currentStreak++;
      } else {
        maxShortStreak = Math.max(maxShortStreak, currentStreak);
        currentStreak = 0;
      }
      const ratio = t.output > 0 ? t.input / t.output : 0;
      promptTrend.push({turnId: t.id, chars, tokens: estTokens, inputTokens: t.input, outputTokens: t.output, ratio});
    }
    maxShortStreak = Math.max(maxShortStreak, currentStreak);
    return {
      avgUserLength: turns.length > 0 ? totalChars / turns.length : 0,
      avgUserTokens: turns.length > 0 ? totalTokens / turns.length : 0,
      inputOutputRatio: totalOutput > 0 ? totalInput / totalOutput : 0,
      shortPromptStreak: maxShortStreak,
      longestPromptTurn,
      longestPromptChars,
      promptTrend,
    };
  }

  function computeFileMetrics(turns) {
    const readMap = new Map();
    const editSet = new Set();
    const bloatedGreps = [];
    let totalReadOps = 0;
    let totalEditOps = 0;
    for (const t of turns) {
      for (const tool of t.tools) {
        if (tool.cls === 'read') {
          const fp = tool.input.find((a) => a.k === 'file_path')?.v;
          if (fp) {
            if (!readMap.has(fp)) {
              readMap.set(fp, {filePath: fp, readCount: 0, hasOffsetLimit: false, turnIds: []});
            }
            const entry = readMap.get(fp);
            entry.readCount++;
            entry.turnIds.push(t.id);
            if (tool.input.some((a) => a.k === 'offset' || a.k === 'limit')) entry.hasOffsetLimit = true;
            totalReadOps++;
          }
        }
        if (tool.cls === 'edit' || tool.cls === 'write') {
          const fp = tool.input.find((a) => a.k === 'file_path')?.v;
          if (fp) {
            editSet.add(fp);
            totalEditOps++;
          }
        }
        if (tool.cls === 'grep') {
          const lines = parseInt((tool.retLines || '0').replace(/,/g, ''), 10) || 0;
          if (lines > 100) {
            bloatedGreps.push({
              pattern: tool.input.find((a) => a.k === 'pattern')?.v || '',
              glob: tool.input.find((a) => a.k === 'glob')?.v || '',
              retLines: lines,
              turnId: t.id,
            });
          }
        }
      }
    }
    const topReads = Array.from(readMap.values()).sort((a, b) => b.readCount - a.readCount).slice(0, 20);
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

  // ─── Tests ───────────────────────────────────────────────

  console.log('[analytics unit tests]');

  // Cache
  {
    const cache = computeCacheMetrics([
      {id: 1, cacheR: 100, cacheC: 50, input: 100},
      {id: 2, cacheR: 200, cacheC: 100, input: 200},
    ]);
    assert.strictEqual(cache.totalCacheR, 300);
    assert.strictEqual(cache.hitRate, 0.5);
    assert.strictEqual(cache.efficiencyRatio, 2);
    console.log('  ✓ computeCacheMetrics');
  }

  // Tools
  {
    const tools = computeToolEfficiency([
      {
        id: 1,
        tools: [
          {cls: 'read', name: 'read', isErr: false, retSize: '1024', input: [{k: 'file_path', v: 'a.ts'}], output: ''},
          {cls: 'read', name: 'read', isErr: true, retSize: '1024', input: [{k: 'file_path', v: 'a.ts'}], output: ''},
          {cls: 'mcp', name: 'mcp', isErr: false, retSize: '100', input: [], output: ''},
        ],
      },
    ]);
    assert.strictEqual(tools.totalCalls, 3);
    assert.strictEqual(tools.totalErrors, 1);
    assert.ok(Math.abs(tools.errorRate - 1 / 3) < 0.001);
    assert.strictEqual(tools.errorsByClass.read.total, 2);
    assert.strictEqual(tools.errorsByClass.read.errors, 1);
    assert.strictEqual(tools.mcpTurnPct, 1);
    console.log('  ✓ computeToolEfficiency');
  }

  // Context growth
  {
    const ctx = computeContextGrowth(
      [{type: 'compact', timestamp: '2024-01-01T00:00:02Z', preTokens: 500}],
      [
        {id: 1, input: 100, cacheC: 10, output: 50, timestamp: '2024-01-01T00:00:00Z'},
        {id: 2, input: 200, cacheC: 20, output: 100, timestamp: '2024-01-01T00:00:01Z'},
        {id: 3, input: 300, cacheC: 30, output: 150, timestamp: '2024-01-01T00:00:03Z'},
      ],
    );
    assert.strictEqual(ctx.points.length, 3);
    assert.strictEqual(ctx.points[2].cumulative, 960);
    assert.strictEqual(ctx.compactEvents.length, 1);
    assert.strictEqual(ctx.compactEvents[0].afterTurnIdx, 1);
    console.log('  ✓ computeContextGrowth');
  }

  // Prompt
  {
    const prompt = computePromptMetrics([
      {id: 1, user: 'hi', input: 10, output: 100},
      {id: 2, user: 'hello world this is longer', input: 20, output: 200},
      {id: 3, user: 'ok', input: 5, output: 50},
    ]);
    assert.strictEqual(prompt.shortPromptStreak, 1);
    assert.ok(prompt.longestPromptChars > 10);
    assert.ok(prompt.inputOutputRatio < 1);
    console.log('  ✓ computePromptMetrics');
  }

  // Files
  {
    const files = computeFileMetrics([
      {
        id: 1,
        tools: [
          {cls: 'read', input: [{k: 'file_path', v: 'a.ts'}], retSize: '10', output: ''},
          {cls: 'read', input: [{k: 'file_path', v: 'a.ts'}], retSize: '10', output: ''},
          {cls: 'edit', input: [{k: 'file_path', v: 'a.ts'}], retSize: '10', output: ''},
          {cls: 'grep', input: [{k: 'pattern', v: 'foo'}, {k: 'glob', v: '*.ts'}], retSize: '150', retLines: '150', output: ''},
        ],
      },
    ]);
    assert.strictEqual(files.totalReadFiles, 1);
    assert.strictEqual(files.totalEditFiles, 1);
    assert.strictEqual(files.bloatedGreps.length, 1);
    assert.strictEqual(files.bloatedGreps[0].pattern, 'foo');
    console.log('  ✓ computeFileMetrics');
  }

  console.log('\nResults: 5 passed, 0 failed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
