import {useMemo} from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeSessionCost} from '../../../utils/cost';
import {computeTimingMetrics, IDLE_THRESHOLD_MS} from '../../../utils/analytics';
import {fmtUsd, fmtDur} from '../../../utils/format';
import {useI18n} from '../../../i18n';
import {
  tooltipStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  cursorStyle,
  gridStroke,
  axisTickStyle,
  cssVar,
  toolColors,
} from '../../../utils/chartTheme';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartGrid from '../common/ChartGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import ColoredBar from '../common/ColoredBar';
import TurnLink from '../common/TurnLink';
import {useChartTurnClick} from '../common/useChartTurnClick';
import s from './TimingPanel.module.scss';

export default function TimingPanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const hooks = useSessionStore((st) => st.hooks);
  const cost = useMemo(() => computeSessionCost(turns), [turns]);
  const timing = useMemo(() => computeTimingMetrics(turns, cost.total), [turns, cost.total]);

  const hookStats = useMemo(() => {
    const byName: Record<string, {totalMs: number; count: number; errors: number}> = {};
    let totalMs = 0;
    for (const h of hooks) {
      const name = h.hookName || h.hookEvent || 'unknown';
      if (!byName[name]) byName[name] = {totalMs: 0, count: 0, errors: 0};
      byName[name]!.totalMs += h.durationMs;
      byName[name]!.count++;
      if (h.exitCode !== 0) byName[name]!.errors++;
      totalMs += h.durationMs;
    }
    const rows = Object.entries(byName)
      .map(([name, v]) => ({
        name,
        avgMs: Math.round(v.totalMs / v.count),
        totalMs: v.totalMs,
        count: v.count,
        errors: v.errors,
      }))
      .sort((a, b) => b.totalMs - a.totalMs);
    return {rows, totalMs};
  }, [hooks]);

  const intervalData = timing.turnIntervals.map((ti) => ({
    turn: `#${ti.turnId}`,
    interval: Math.round((ti.intervalMs / 1000) * 10) / 10, // seconds with 1 decimal
    isIdle: ti.isIdle,
  }));

  const tlc = toolColors();
  const onChartClick = useChartTurnClick();
  const toolDurData = Object.entries(timing.toolDurByClass)
    .map(([cls, d]) => ({
      cls,
      avgMs: Math.round(d.avgMs),
      totalMs: Math.round(d.totalMs),
      count: d.count,
      color: (tlc as Record<string, string>)[cls] ?? '#666',
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard label={t('timing.sessionDuration')} value={fmtDur(timing.sessionDurationMs)} />
        <StatCard label={t('timing.costPerMinute')} value={fmtUsd(timing.costPerMinute)} />
        <StatCard
          label={t('timing.idleTime')}
          value={`${(timing.idlePct * 100).toFixed(0)}%`}
          sub={fmtDur(timing.idleTimeMs)}
          color={timing.idlePct > 0.5 ? 'var(--warning)' : undefined}
        />
        <StatCard label={t('timing.avgTurnInterval')} value={fmtDur(timing.avgTurnIntervalMs)} />
        <StatCard label={t('timing.totalToolTime')} value={fmtDur(timing.totalToolDurationMs)} />
      </CardGrid>

      {/* Turn interval chart */}
      {intervalData.length > 0 && (
        <ChartBox title={t('timing.turnIntervals')}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={intervalData} margin={{top: 8, right: 12, bottom: 4, left: 8}} onClick={onChartClick}>
              <defs>
                <linearGradient id="intervalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssVar('--accent') || '#58a6ff'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={cssVar('--accent') || '#58a6ff'} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke()} strokeDasharray="3 3" />
              <XAxis dataKey="turn" tick={axisTickStyle()} interval="preserveStartEnd" />
              <YAxis tick={axisTickStyle()} width={45} />
              <Tooltip
                contentStyle={tooltipStyle()}
                labelStyle={tooltipLabelStyle()}
                itemStyle={tooltipItemStyle()}
                formatter={(value) => `${value}s`}
                cursor={cursorStyle()}
              />
              <ReferenceLine
                y={IDLE_THRESHOLD_MS / 1000}
                stroke={cssVar('--warning') || '#d29922'}
                strokeDasharray="4 4"
                label={{
                  value: t('timing.idleThreshold', {seconds: IDLE_THRESHOLD_MS / 1000}),
                  fill: cssVar('--warning') || '#d29922',
                  fontSize: 10,
                  position: 'right',
                }}
              />
              <Area
                type="monotone"
                dataKey="interval"
                stroke={cssVar('--accent') || '#58a6ff'}
                fill="url(#intervalGrad)"
                strokeWidth={1.5}
                name={t('timing.interval')}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

      {toolDurData.length > 0 && (
        <ChartGrid>
          {[
            {key: 'avgMs' as const, title: t('timing.avgToolDuration'), name: t('timing.avgDuration')},
            {key: 'totalMs' as const, title: t('timing.totalToolDuration'), name: t('timing.totalDuration')},
          ].map((cfg) => (
            <ChartBox key={cfg.key} title={cfg.title}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={toolDurData} layout="vertical" margin={{top: 4, right: 12, bottom: 4, left: 60}}>
                  <CartesianGrid horizontal={false} stroke={gridStroke()} strokeDasharray="3 3" />
                  <XAxis type="number" tick={axisTickStyle()} tickFormatter={(v) => fmtDur(v)} />
                  <YAxis type="category" dataKey="cls" tick={axisTickStyle()} width={50} />
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    labelStyle={tooltipLabelStyle()}
                    itemStyle={tooltipItemStyle()}
                    formatter={(value) => fmtDur(Number(value))}
                    cursor={cursorStyle()}
                  />
                  <Bar dataKey={cfg.key} shape={<ColoredBar />} name={cfg.name} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          ))}
        </ChartGrid>
      )}

      {/* Slowest tools table */}
      {timing.slowestTools.length > 0 && (
        <ChartBox title={t('timing.slowestToolCalls')}>
          <table className={s.slowTable}>
            <thead>
              <tr>
                <th>{t('timing.tool')}</th>
                <th>{t('timing.turn')}</th>
                <th>{t('timing.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {timing.slowestTools.map((st, i) => (
                <tr key={i}>
                  <td className={s.toolName}>{st.toolName}</td>
                  <td>
                    <TurnLink turnId={st.turnId} />
                  </td>
                  <td>{fmtDur(st.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartBox>
      )}

      {/* Hook performance */}
      {hookStats.rows.length > 0 && (
        <ChartBox title={t('timing.hookPerformance')}>
          <CardGrid minWidth={130}>
            <StatCard label={t('timing.totalHookTime')} value={fmtDur(hookStats.totalMs)} />
            <StatCard label={t('timing.hookCalls')} value={String(hooks.length)} />
          </CardGrid>
          <table className={s.slowTable} style={{marginTop: 12}}>
            <thead>
              <tr>
                <th>{t('timing.hook')}</th>
                <th>{t('timing.count')}</th>
                <th>{t('timing.avgDuration')}</th>
                <th>{t('timing.totalDuration')}</th>
                <th>{t('timing.errors')}</th>
              </tr>
            </thead>
            <tbody>
              {hookStats.rows.map((h, i) => (
                <tr key={i}>
                  <td className={s.toolName}>{h.name}</td>
                  <td>{h.count}</td>
                  <td>{fmtDur(h.avgMs)}</td>
                  <td>{fmtDur(h.totalMs)}</td>
                  <td style={{color: h.errors > 0 ? 'var(--danger)' : undefined}}>{h.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartBox>
      )}
    </Panel>
  );
}
