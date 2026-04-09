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
import s from './TimingPanel.module.scss';

export default function TimingPanel() {
  const turns = useSessionStore((st) => st.turns);
  const cost = useMemo(() => computeSessionCost(turns), [turns]);
  const timing = useMemo(() => computeTimingMetrics(turns, cost.total), [turns, cost.total]);

  const intervalData = timing.turnIntervals.map((t) => ({
    turn: `#${t.turnId}`,
    interval: Math.round(t.intervalMs / 1000 * 10) / 10, // seconds with 1 decimal
    isIdle: t.isIdle,
  }));

  const tlc = toolColors();
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
        <StatCard label="Session Duration" value={fmtDur(timing.sessionDurationMs)} />
        <StatCard
          label="Cost / Minute"
          value={fmtUsd(timing.costPerMinute)}
        />
        <StatCard
          label="Idle Time"
          value={`${(timing.idlePct * 100).toFixed(0)}%`}
          sub={fmtDur(timing.idleTimeMs)}
          color={timing.idlePct > 0.5 ? 'var(--warning)' : undefined}
        />
        <StatCard label="Avg Turn Interval" value={fmtDur(timing.avgTurnIntervalMs)} />
        <StatCard label="Total Tool Time" value={fmtDur(timing.totalToolDurationMs)} />
      </CardGrid>

      {/* Turn interval chart */}
      {intervalData.length > 0 && (
        <ChartBox title="Turn Intervals (seconds)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={intervalData} margin={{top: 8, right: 12, bottom: 4, left: 8}}>
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
                label={{value: `idle threshold (${IDLE_THRESHOLD_MS / 1000}s)`, fill: cssVar('--warning') || '#d29922', fontSize: 10, position: 'right'}}
              />
              <Area
                type="monotone"
                dataKey="interval"
                stroke={cssVar('--accent') || '#58a6ff'}
                fill="url(#intervalGrad)"
                strokeWidth={1.5}
                name="Interval"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

      {toolDurData.length > 0 && (
        <ChartGrid>
          {[
            {key: 'avgMs' as const, title: 'Avg Tool Duration by Category', name: 'Avg Duration'},
            {key: 'totalMs' as const, title: 'Total Tool Duration by Category', name: 'Total Duration'},
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
        <ChartBox title="Slowest Tool Calls">
          <table className={s.slowTable}>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Turn</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {timing.slowestTools.map((t, i) => (
                <tr key={i}>
                  <td className={s.toolName}>{t.toolName}</td>
                  <td>#{t.turnId}</td>
                  <td>{fmtDur(t.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartBox>
      )}
    </Panel>
  );
}
