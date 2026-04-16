const assert = require('assert');

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
    promptTrend.push({
      turnId: t.id,
      chars,
      tokens: estTokens,
      inputTokens: t.input,
      outputTokens: t.output,
      ratio,
    });
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

// Tests
const turns = [
  { id: 1, user: 'hi', input: 10, output: 100 },
  { id: 2, user: 'ok', input: 12, output: 200 },
  { id: 3, user: 'explain this in detail please', input: 30, output: 500 },
  { id: 4, user: 'a'.repeat(2500), input: 800, output: 50 },
];

const metrics = computePromptMetrics(turns);
assert.strictEqual(metrics.avgUserLength, (2 + 2 + 29 + 2500) / 4);
assert.strictEqual(metrics.shortPromptStreak, 2);
assert.strictEqual(metrics.longestPromptTurn, 4);
assert.strictEqual(metrics.longestPromptChars, 2500);
assert.ok(Math.abs(metrics.inputOutputRatio - (10 + 12 + 30 + 800) / (100 + 200 + 500 + 50)) < 0.001);
assert.strictEqual(metrics.promptTrend.length, 4);
assert.strictEqual(metrics.promptTrend[0].chars, 2);

// Empty turns
const empty = computePromptMetrics([]);
assert.strictEqual(empty.avgUserLength, 0);
assert.strictEqual(empty.shortPromptStreak, 0);
assert.strictEqual(empty.longestPromptTurn, -1);

console.log('All prompt metrics tests passed!');
