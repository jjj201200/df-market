import type {SessionCost} from '../cost';
import type {TFunction} from '../../i18n';
import {fmtPct, fmtTokens} from '../format';
import {getModelPricing} from '../cost';
import type {CacheMetrics} from './cache';
import type {ToolEfficiency} from './tools';
import type {ContextGrowth} from './context';
import type {SubagentEfficiency} from './subagent';
import type {ModelBreakdown} from './model';
import type {ThinkingMetrics} from './thinking';
import type {SidechainMetrics} from './sidechain';
import type {TimingMetrics} from './timing';
import type {McpMetrics} from './mcp';
import type {PromptMetrics} from './prompt';
import type {PressureMetrics} from './pressure';
import type {FileMetrics} from './files';

export interface Recommendation {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'cache' | 'tools' | 'context' | 'cost';
  title: string;
  detail: string;
  estimatedSavings?: string;
}

export interface RecommendationInput {
  cache: CacheMetrics;
  tools: ToolEfficiency;
  context: ContextGrowth;
  subagent: SubagentEfficiency;
  cost: SessionCost;
  modelBreakdown?: ModelBreakdown;
  thinking?: ThinkingMetrics;
  sidechain?: SidechainMetrics;
  timing?: TimingMetrics;
  mcp?: McpMetrics;
  prompt?: PromptMetrics;
  pressure?: PressureMetrics;
  files?: FileMetrics;
}

export function generateRecommendations(input: RecommendationInput, t: TFunction): Recommendation[] {
  const {
    cache,
    tools,
    context,
    subagent,
    cost,
    modelBreakdown,
    thinking,
    sidechain,
    timing,
    mcp,
    prompt,
    pressure,
    files,
  } = input;
  const recs: Recommendation[] = [];
  const usd = (v: number) => `$${v.toFixed(4)}`;

  if (cache.hitRate < 0.3 && cache.totalInput > 10000) {
    recs.push({
      id: 'low-cache',
      severity: 'high',
      category: 'cache',
      title: t('rec.lowCache.title', {rate: fmtPct(cache.hitRate)}),
      detail: t('rec.lowCache.detail'),
      estimatedSavings: t('rec.lowCache.savings', {
        amount: usd(
          (cache.totalInput *
            0.5 *
            (getModelPricing('claude-sonnet-4-6').input - getModelPricing('claude-sonnet-4-6').cacheRead)) /
            1_000_000,
        ),
      }),
    });
  }

  if (tools.errorRate > 0.15 && tools.totalCalls > 5) {
    recs.push({
      id: 'tool-errors',
      severity: 'high',
      category: 'tools',
      title: t('rec.toolErrors.title', {
        errors: tools.totalErrors,
        total: tools.totalCalls,
        rate: fmtPct(tools.errorRate),
      }),
      detail: t('rec.toolErrors.detail'),
    });
  }

  if (tools.redundantGroups.length > 0) {
    const totalRedundant = tools.redundantGroups.reduce((s, g) => s + g.count - 1, 0);
    recs.push({
      id: 'redundant-tools',
      severity: totalRedundant > 5 ? 'high' : 'medium',
      category: 'tools',
      title: t('rec.redundantTools.title', {count: totalRedundant}),
      detail: t('rec.redundantTools.detail', {
        groups: tools.redundantGroups.length,
        top: `${tools.redundantGroups[0]!.cls}(${tools.redundantGroups[0]!.keyParam.slice(0, 60)}) x${tools.redundantGroups[0]!.count}`,
      }),
    });
  }

  if (context.compactEvents.length >= 2) {
    const avgTurns = context.points.length > 0 ? context.points.length / (context.compactEvents.length + 1) : Infinity;
    if (avgTurns < 15) {
      recs.push({
        id: 'frequent-compact',
        severity: 'medium',
        category: 'context',
        title: t('rec.frequentCompact.title', {count: context.compactEvents.length, avgTurns: Math.round(avgTurns)}),
        detail: t('rec.frequentCompact.detail'),
      });
    }
  }

  if (cost.total > 0) {
    const outputPct = cost.byType.output / cost.total;
    if (outputPct > 0.6) {
      recs.push({
        id: 'high-output',
        severity: 'medium',
        category: 'cost',
        title: t('rec.highOutput.title', {pct: fmtPct(outputPct)}),
        detail: t('rec.highOutput.detail'),
      });
    }
  }

  if (tools.largeCalls.length > 3) {
    recs.push({
      id: 'large-returns',
      severity: 'medium',
      category: 'tools',
      title: t('rec.largeReturns.title', {count: tools.largeCalls.length}),
      detail: t('rec.largeReturns.detail', {
        toolName: tools.largeCalls[0]!.toolName,
        retSize: tools.largeCalls[0]!.retSize,
      }),
    });
  }

  if (subagent.subagentCostPct > 0.5 && subagent.agents.length > 0) {
    recs.push({
      id: 'subagent-cost',
      severity: 'medium',
      category: 'cost',
      title: t('rec.subagentCost.title', {pct: fmtPct(subagent.subagentCostPct)}),
      detail: t('rec.subagentCost.detail'),
      estimatedSavings: t('rec.subagentCost.savings', {amount: usd(subagent.totalSubagentCost * 0.8)}),
    });
  }

  if (cache.hitRate >= 0.6 && cache.totalInput > 10000) {
    recs.push({
      id: 'good-cache',
      severity: 'low',
      category: 'cache',
      title: t('rec.goodCache.title', {rate: fmtPct(cache.hitRate)}),
      detail: t('rec.goodCache.detail', {amount: usd(cache.estimatedSavings)}),
    });
  }

  if (timing && timing.idlePct > 0.5 && timing.turnIntervals.length > 10) {
    recs.push({
      id: 'high-idle',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highIdle.title', {pct: fmtPct(timing.idlePct)}),
      detail: t('rec.highIdle.detail'),
    });
  }

  if (timing) {
    for (const [cls, dur] of Object.entries(timing.toolDurByClass)) {
      if (dur.avgMs > 5000 && dur.count > 3) {
        recs.push({
          id: `slow-tool-${cls}`,
          severity: 'medium',
          category: 'tools',
          title: t('rec.slowTool.title', {cls, time: (dur.avgMs / 1000).toFixed(1)}),
          detail: t('rec.slowTool.detail', {count: dur.count, cls}),
        });
        break;
      }
    }
  }

  if (thinking && cost.total > 0 && thinking.estimatedThinkingCost / cost.total > 0.3) {
    recs.push({
      id: 'high-thinking',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highThinking.title', {pct: fmtPct(thinking.estimatedThinkingCost / cost.total)}),
      detail: t('rec.highThinking.detail', {tokens: Math.round(thinking.estimatedThinkingTokens / 1000)}),
    });
  }

  if (modelBreakdown) {
    const opusEntry = modelBreakdown.models.find((m) => m.model.includes('opus'));
    if (opusEntry && opusEntry.turns > 5 && opusEntry.avgOutputPerTurn < 500) {
      recs.push({
        id: 'opus-simple-tasks',
        severity: 'medium',
        category: 'cost',
        title: t('rec.opusSimple.title', {turns: opusEntry.turns}),
        detail: t('rec.opusSimple.detail', {tokens: Math.round(opusEntry.avgOutputPerTurn)}),
        estimatedSavings: usd(opusEntry.cost * 0.8),
      });
    }
  }

  if (sidechain && sidechain.sidechainCostPct > 0.4 && sidechain.sidechainTurns > 0) {
    recs.push({
      id: 'high-sidechain',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highSidechain.title', {pct: fmtPct(sidechain.sidechainCostPct)}),
      detail: t('rec.highSidechain.detail', {turns: sidechain.sidechainTurns, amount: usd(sidechain.sidechainCost)}),
    });
  }

  if (mcp && mcp.mcpPct > 0.3 && mcp.totalMcpCalls > 3) {
    recs.push({
      id: 'high-mcp',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highMcp.title', {pct: fmtPct(mcp.mcpPct)}),
      detail: t('rec.highMcp.detail', {count: mcp.totalMcpCalls}),
    });
  }

  if (mcp) {
    for (const [server, stats] of Object.entries(mcp.byServer)) {
      if (stats.errorRate > 0.2 && stats.calls > 2) {
        recs.push({
          id: `mcp-errors-${server}`,
          severity: 'high',
          category: 'tools',
          title: t('rec.mcpErrors.title', {server, rate: fmtPct(stats.errorRate)}),
          detail: t('rec.mcpErrors.detail', {server, count: stats.calls}),
        });
        break;
      }
    }
  }

  if (mcp) {
    for (const [server, stats] of Object.entries(mcp.byServer)) {
      if (stats.avgMs > 5000 && stats.calls > 2) {
        recs.push({
          id: `slow-mcp-${server}`,
          severity: 'medium',
          category: 'tools',
          title: t('rec.slowMcp.title', {server, time: (stats.avgMs / 1000).toFixed(1)}),
          detail: t('rec.slowMcp.detail', {server, count: stats.calls}),
        });
        break;
      }
    }
  }

  if (prompt && prompt.shortPromptStreak >= 3) {
    recs.push({
      id: 'fragmented-prompts',
      severity: 'medium',
      category: 'cost',
      title: t('rec.fragmentedPrompts.title', {count: prompt.shortPromptStreak}),
      detail: t('rec.fragmentedPrompts.detail'),
    });
  }

  if (prompt && prompt.longestPromptChars > 2000) {
    const turn = prompt.promptTrend.find((p) => p.turnId === prompt.longestPromptTurn);
    if (turn && turn.outputTokens < turn.tokens * 0.1) {
      recs.push({
        id: 'bloated-prompt',
        severity: 'medium',
        category: 'cost',
        title: t('rec.bloatedPrompt.title', {chars: prompt.longestPromptChars}),
        detail: t('rec.bloatedPrompt.detail'),
      });
    }
  }

  if (prompt && prompt.inputOutputRatio < 0.1) {
    const highOutputTurns = prompt.promptTrend.filter((p) => p.outputTokens > 5000).length;
    if (highOutputTurns > 0) {
      recs.push({
        id: 'vague-prompt',
        severity: 'medium',
        category: 'cost',
        title: t('rec.vaguePrompt.title', {ratio: fmtPct(prompt.inputOutputRatio)}),
        detail: t('rec.vaguePrompt.detail', {count: highOutputTurns}),
      });
    }
  }

  if (pressure && pressure.compactionCount >= 2 && pressure.avgTurnsBetweenCompact < 10) {
    recs.push({
      id: 'high-pressure',
      severity: 'high',
      category: 'context',
      title: t('rec.highPressure.title', {
        count: pressure.compactionCount,
        avg: Math.round(pressure.avgTurnsBetweenCompact),
      }),
      detail: t('rec.highPressure.detail'),
    });
  }

  if (pressure && pressure.highSpikeTurns.length > 0) {
    recs.push({
      id: 'context-spike',
      severity: 'medium',
      category: 'context',
      title: t('rec.contextSpike.title', {count: pressure.highSpikeTurns.length}),
      detail: t('rec.contextSpike.detail', {
        turnId: pressure.highSpikeTurns[0]!.turnId,
        delta: fmtTokens(pressure.highSpikeTurns[0]!.delta),
      }),
    });
  }

  if (files) {
    const repeated = files.topReads.find((r) => r.readCount >= 3 && !r.hasOffsetLimit);
    if (repeated) {
      recs.push({
        id: 'repeated-reads',
        severity: 'medium',
        category: 'tools',
        title: t('rec.repeatedReads.title', {file: repeated.filePath, count: repeated.readCount}),
        detail: t('rec.repeatedReads.detail'),
      });
    }
  }

  if (files && files.bloatedGreps.length > 2) {
    recs.push({
      id: 'bloated-grep',
      severity: 'medium',
      category: 'tools',
      title: t('rec.bloatedGrep.title', {count: files.bloatedGreps.length}),
      detail: t('rec.bloatedGrep.detail', {pattern: files.bloatedGreps[0]!.pattern.slice(0, 60)}),
    });
  }

  if (files && files.readEditRatio > 5 && files.totalReadFiles > 5) {
    recs.push({
      id: 'low-edit-coverage',
      severity: 'low',
      category: 'tools',
      title: t('rec.lowEditCoverage.title', {ratio: files.readEditRatio.toFixed(1)}),
      detail: t('rec.lowEditCoverage.detail'),
    });
  }

  return recs.sort((a, b) => {
    const ord = {high: 0, medium: 1, low: 2};
    return ord[a.severity] - ord[b.severity];
  });
}
