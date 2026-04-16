const assert = require('assert');

function computeContextGrowth(data, turns) {
  const points = [];
  let cumulative = 0;
  for (const t of turns) {
    const delta = t.input + t.cacheC + t.output;
    cumulative += delta;
    points.push({ turnId: t.id, cumulative, delta });
  }
  const compactEvents = [];
  for (const item of data) {
    if (item.type === 'compact') {
      let afterIdx = 0;
      for (let i = 0; i < turns.length; i++) {
        if (turns[i].timestamp <= item.timestamp) afterIdx = i;
      }
      compactEvents.push({ timestamp: item.timestamp, preTokens: item.preTokens, afterTurnIdx: afterIdx });
    }
  }
  return { points, compactEvents, avgGrowthPerTurn: points.length > 0 ? cumulative / points.length : 0 };
}

function computePressureMetrics(data, turns) {
  const context = computeContextGrowth(data, turns);
  const points = context.points;

  let peakTokens = 0;
  let peakTurnId = -1;
  for (const p of points) {
    if (p.cumulative > peakTokens) {
      peakTokens = p.cumulative;
      peakTurnId = p.turnId;
    }
  }

  const compactionCount = context.compactEvents.length;
  const avgTurnsBetweenCompact = compactionCount > 0 && points.length > 0
    ? points.length / (compactionCount + 1)
    : points.length;

  const highSpikeTurns = points
    .filter((p) => p.delta > 20000)
    .map((p) => ({ turnId: p.turnId, delta: p.delta }))
    .slice(0, 10);

  let growthRatePer10Turns = 0;
  if (points.length >= 10) {
    const first = points[0].cumulative;
    const tenth = points[9].cumulative;
    growthRatePer10Turns = tenth - first;
  } else if (points.length > 1) {
    const first = points[0].cumulative;
    const last = points[points.length - 1].cumulative;
    growthRatePer10Turns = ((last - first) / points.length) * 10;
  }

  let estimatedTurnsToLimit = null;
  if (points.length > 1 && growthRatePer10Turns > 0) {
    const remaining = 200_000 - peakTokens;
    estimatedTurnsToLimit = Math.round((remaining / growthRatePer10Turns) * 10);
    if (estimatedTurnsToLimit < 0) estimatedTurnsToLimit = 0;
  }

  return {
    peakTokens,
    peakTurnId,
    compactionCount,
    avgTurnsBetweenCompact,
    highSpikeTurns,
    growthRatePer10Turns,
    estimatedTurnsToLimit,
  };
}

// Tests
const turns = [
  { id: 1, timestamp: '2026-01-01T00:00:01Z', input: 1000, output: 500, cacheC: 0 },
  { id: 2, timestamp: '2026-01-01T00:00:02Z', input: 2000, output: 1000, cacheC: 0 },
  { id: 3, timestamp: '2026-01-01T00:00:03Z', input: 5000, output: 25000, cacheC: 0 },
  { id: 4, timestamp: '2026-01-01T00:00:04Z', input: 1000, output: 500, cacheC: 0 },
];

const data = [
  { type: 'compact', timestamp: '2026-01-01T00:00:02Z', preTokens: 5000 },
];

const metrics = computePressureMetrics(data, turns);
assert.strictEqual(metrics.peakTokens, 36000, 'peakTokens should be 36000');
assert.strictEqual(metrics.peakTurnId, 4, 'peakTurnId should be 4');
assert.strictEqual(metrics.compactionCount, 1, 'compactionCount should be 1');
assert.strictEqual(metrics.highSpikeTurns.length, 1, 'should have 1 high spike');
assert.strictEqual(metrics.highSpikeTurns[0].turnId, 3, 'high spike turn should be 3');

// Empty
const empty = computePressureMetrics([], []);
assert.strictEqual(empty.peakTokens, 0);
assert.strictEqual(empty.peakTurnId, -1);
assert.strictEqual(empty.compactionCount, 0);

console.log('All pressure metrics tests passed!');
