import {useMemo} from 'react';
import clsx from 'clsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeCacheMetrics} from '../../../utils/analytics';
import {tokenColors, tooltipStyle, tooltipLabelStyle, tooltipItemStyle, gridStroke, axisTickStyle, cssVar} from '../../../utils/chartTheme';
import {fmtUsd, fmtTokens, fmtPct as pct} from '../../../utils/format';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import s from './CachePanel.module.scss';

function hitRateLevel(rate: number): 'good' | 'ok' | 'bad' {
  if (rate >= 0.6) return 'good';
  if (rate >= 0.3) return 'ok';
  return 'bad';
}

export default function CachePanel() {
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const cache = useMemo(() => computeCacheMetrics(turns), [turns]);

  // Find compact events for reference lines
  const compactTurnIds = useMemo(() => {
    const ids: number[] = [];
    for (const item of data) {
      if (item.type === 'compact') {
        // Find nearest turn
        let nearestId = 1;
        for (const t of turns) {
          if (t.timestamp <= item.timestamp) nearestId = t.id;
        }
        ids.push(nearestId);
      }
    }
    return ids;
  }, [data, turns]);

  const chartData = cache.perTurnHitRate.map((p) => ({
    turn: `#${p.turnId}`,
    hitRate: Math.round(p.rate * 100),
  }));

  const tc = tokenColors();
  const level = hitRateLevel(cache.hitRate);
  const levelColor =
    level === 'good' ? 'var(--success)' : level === 'ok' ? 'var(--warning)' : 'var(--danger)';

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard label="Cache Hit Rate" value={pct(cache.hitRate)} color={levelColor} />
        <StatCard
          label="Efficiency Ratio"
          value={cache.efficiencyRatio.toFixed(1) + 'x'}
          sub="cache reads per creation"
        />
        <StatCard label="Estimated Savings" value={fmtUsd(cache.estimatedSavings)} color="var(--success)" />
        <StatCard label="Cache Read Tokens" value={fmtTokens(cache.totalCacheR)} color={tc.cacheRead} />
        <StatCard label="Cache Create Tokens" value={fmtTokens(cache.totalCacheC)} color={tc.cacheCreation} />
      </CardGrid>

      {/* Gauge visualization */}
      <div className={s.gaugeBox}>
        <div className={s.gaugeTitle}>Cache Hit Rate</div>
        <div className={s.gauge}>
          <div className={s.gaugeBg}>
            <div className={clsx(s.gaugeFill, s[level])} style={{width: pct(Math.min(cache.hitRate, 1))}} />
          </div>
          <div className={s.gaugeLabels}>
            <span>0%</span>
            <span className={s.gaugeTarget}>Target: 60-80%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Per-turn hit rate chart */}
      <ChartBox title="Cache Hit Rate per Turn">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{top: 8, right: 12, bottom: 4, left: 0}}>
            <CartesianGrid stroke={gridStroke()} strokeDasharray="3 3" />
            <XAxis dataKey="turn" tick={axisTickStyle()} interval="preserveStartEnd" />
            <YAxis tick={axisTickStyle()} domain={[0, 100]} unit="%" width={45} />
            <Tooltip
              contentStyle={tooltipStyle()}
              labelStyle={tooltipLabelStyle()}
              itemStyle={tooltipItemStyle()}
              formatter={(value) => `${value}%`}
              cursor={{stroke: cssVar('--border-strong') || '#444'}}
            />
            <Line type="monotone" dataKey="hitRate" stroke={tc.cacheRead} dot={false} strokeWidth={2} />
            {/* Compact event markers */}
            {compactTurnIds.map((id, i) => (
              <ReferenceLine
                key={i}
                x={`#${id}`}
                stroke={cssVar('--danger') || '#f85149'}
                strokeDasharray="4 4"
                label={{value: 'compact', fill: cssVar('--danger') || '#f85149', fontSize: 10, position: 'top'}}
              />
            ))}
            {/* Target zone */}
            <ReferenceLine y={60} stroke={cssVar('--success') || '#3fb950'} strokeDasharray="3 3" />
            <ReferenceLine y={80} stroke={cssVar('--success') || '#3fb950'} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </ChartBox>
    </Panel>
  );
}
