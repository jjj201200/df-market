import {useMemo} from 'react';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
import {
  computeCacheMetrics,
  computeToolEfficiency,
  computeContextGrowth,
  computeSubagentEfficiency,
  computeModelBreakdown,
  computeThinkingMetrics,
  computeSidechainMetrics,
  computeTimingMetrics,
  computeMcpMetrics,
  computePromptMetrics,
  computePressureMetrics,
  computeFileMetrics,
  generateRecommendations,
} from '../../../utils/analytics';
import {computeSessionCost} from '../../../utils/cost';
import {fmtUsd, fmtTokens, fmtPct, fmtDur} from '../../../utils/format';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import RecommendationCard from '../OverviewPanel/RecommendationCard';
import TurnLink from '../common/TurnLink';
import s from './SummaryPanel.module.scss';

export default function SummaryPanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const subagents = useSessionStore((st) => st.subagents);

  const cost = useMemo(() => computeSessionCost(turns), [turns]);
  const cache = useMemo(() => computeCacheMetrics(turns), [turns]);
  const tools = useMemo(() => computeToolEfficiency(turns), [turns]);
  const context = useMemo(() => computeContextGrowth(data, turns), [data, turns]);
  const subagent = useMemo(() => computeSubagentEfficiency(subagents, turns), [subagents, turns]);
  const modelBreakdown = useMemo(() => computeModelBreakdown(turns), [turns]);
  const thinking = useMemo(
    () => computeThinkingMetrics(turns, modelBreakdown.dominantModelId),
    [turns, modelBreakdown.dominantModelId],
  );
  const sidechain = useMemo(() => computeSidechainMetrics(turns), [turns]);
  const timing = useMemo(() => computeTimingMetrics(turns, cost.total), [turns, cost.total]);
  const mcp = useMemo(() => computeMcpMetrics(turns), [turns]);
  const prompt = useMemo(() => computePromptMetrics(turns), [turns]);
  const pressure = useMemo(() => computePressureMetrics(data, turns), [data, turns]);
  const files = useMemo(() => computeFileMetrics(turns), [turns]);

  const recommendations = useMemo(
    () =>
      generateRecommendations(
        {
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
        },
        t,
      ),
    [
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
      t,
    ],
  );

  const totalTokens = turns.reduce((sum, t) => sum + t.input + t.output + t.cacheR + t.cacheC, 0);

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard
          label={t('overview.totalCost')}
          value={fmtUsd(cost.total)}
          sub={t('overview.nTurns', {count: turns.length})}
        />
        <StatCard label={t('overview.totalTokens')} value={fmtTokens(totalTokens)} />
        <StatCard label={t('cache.hitRate')} value={fmtPct(cache.hitRate)} sub={t('cache.target')} />
        <StatCard
          label={t('tools.errorRate')}
          value={fmtPct(tools.errorRate)}
          sub={t('tools.nFailed', {count: tools.totalErrors})}
        />
      </CardGrid>

      {/* Key insights */}
      <ChartBox title={t('summary.keyInsights')}>
        <div className={s.insights}>
          <div className={s.insight}>
            <span className={s.insightLabel}>{t('summary.dominantModel')}</span>
            <span className={s.insightValue}>{modelBreakdown.dominantModel || '-'}</span>
          </div>
          {subagent.agents.length > 0 && (
            <div className={s.insight}>
              <span className={s.insightLabel}>{t('summary.subagentCost')}</span>
              <span className={s.insightValue}>{fmtUsd(subagent.totalSubagentCost)}</span>
              <span className={s.insightSub}>{fmtPct(subagent.subagentCostPct)}</span>
            </div>
          )}
          {sidechain.sidechainTurns > 0 && (
            <div className={s.insight}>
              <span className={s.insightLabel}>{t('summary.sidechainCost')}</span>
              <span className={s.insightValue}>{fmtUsd(sidechain.sidechainCost)}</span>
              <span className={s.insightSub}>{fmtPct(sidechain.sidechainCostPct)}</span>
            </div>
          )}
          {thinking.turnsWithThinking > 0 && (
            <div className={s.insight}>
              <span className={s.insightLabel}>{t('summary.thinkingCost')}</span>
              <span className={s.insightValue}>{fmtUsd(thinking.estimatedThinkingCost)}</span>
              <span className={s.insightSub}>
                {t('overview.tokensEstimate', {tokens: fmtTokens(thinking.estimatedThinkingTokens)})}
              </span>
            </div>
          )}
          {mcp.totalMcpCalls > 0 && (
            <div className={s.insight}>
              <span className={s.insightLabel}>{t('summary.mcpCalls')}</span>
              <span className={s.insightValue}>{String(mcp.totalMcpCalls)}</span>
              <span className={s.insightSub}>{fmtPct(mcp.mcpPct)}</span>
            </div>
          )}
          {timing.sessionDurationMs > 0 && (
            <div className={s.insight}>
              <span className={s.insightLabel}>{t('summary.sessionDuration')}</span>
              <span className={s.insightValue}>{fmtDur(timing.sessionDurationMs)}</span>
              <span className={s.insightSub}>
                {t('summary.costPerMinute')}: {fmtUsd(timing.costPerMinute)}
              </span>
            </div>
          )}
          {pressure.peakTokens > 0 && (
            <div className={s.insight}>
              <span className={s.insightLabel}>{t('summary.peakContext')}</span>
              <span className={s.insightValue}>{fmtTokens(pressure.peakTokens)}</span>
              <span className={s.insightSub}>
                {t('summary.atTurn')} <TurnLink turnId={pressure.peakTurnId} />
              </span>
            </div>
          )}
          {files.totalReadFiles > 0 && (
            <div className={s.insight}>
              <span className={s.insightLabel}>{t('summary.fileActivity')}</span>
              <span className={s.insightValue}>
                {t('summary.readEdit', {read: files.totalReadFiles, edit: files.totalEditFiles})}
              </span>
              <span className={s.insightSub}>
                {t('files.bloatedGreps')}: {files.bloatedGreps.length}
              </span>
            </div>
          )}
        </div>
      </ChartBox>

      {/* Top recommendations */}
      {recommendations.length > 0 && (
        <ChartBox title={t('summary.topRecommendations')}>
          <div className={s.recs}>
            {recommendations.slice(0, 5).map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        </ChartBox>
      )}
    </Panel>
  );
}
