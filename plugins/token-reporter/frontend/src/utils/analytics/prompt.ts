import type {TurnItem} from '../../types/state';

export interface PromptMetrics {
  avgUserLength: number;
  avgUserTokens: number;
  inputOutputRatio: number;
  shortPromptStreak: number;
  longestPromptTurn: number;
  longestPromptChars: number;
  promptTrend: {
    turnId: number;
    chars: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    ratio: number;
  }[];
}

export function computePromptMetrics(turns: TurnItem[]): PromptMetrics {
  let totalChars = 0;
  let totalTokens = 0;
  let longestPromptChars = 0;
  let longestPromptTurn = -1;
  let maxShortStreak = 0;
  let currentStreak = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const promptTrend: PromptMetrics['promptTrend'] = [];

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
