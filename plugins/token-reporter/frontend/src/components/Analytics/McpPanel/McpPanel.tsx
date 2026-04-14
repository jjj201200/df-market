import {useMemo} from 'react';
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
import {computeMcpMetrics} from '../../../utils/analytics';
import {fmtDur, fmtPct} from '../../../utils/format';
import {
  tooltipStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  cursorStyle,
  gridStroke,
  axisTickStyle,
} from '../../../utils/chartTheme';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import s from './McpPanel.module.scss';

export default function McpPanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const mcp = useMemo(() => computeMcpMetrics(turns), [turns]);

  const methodChartData = useMemo(() => {
    const rows: {name: string; calls: number; errors: number; avgMs: number; totalMs: number}[] = [];
    for (const [server, stats] of Object.entries(mcp.byServer)) {
      for (const [method, m] of Object.entries(stats.methods)) {
        rows.push({
          name: `${server}.${method}`,
          calls: m.calls,
          errors: m.errors,
          avgMs: Math.round(m.avgMs),
          totalMs: Math.round(m.totalMs),
        });
      }
    }
    return rows.sort((a, b) => b.calls - a.calls).slice(0, 20);
  }, [mcp.byServer]);

  const methodData = useMemo(() => {
    const rows: {server: string; method: string; calls: number; errors: number; avgMs: number; totalMs: number}[] = [];
    for (const [server, stats] of Object.entries(mcp.byServer)) {
      for (const [method, m] of Object.entries(stats.methods)) {
        rows.push({
          server,
          method,
          calls: m.calls,
          errors: m.errors,
          avgMs: Math.round(m.avgMs),
          totalMs: Math.round(m.totalMs),
        });
      }
    }
    return rows.sort((a, b) => b.calls - a.calls);
  }, [mcp.byServer]);

  if (mcp.totalMcpCalls === 0) {
    return (
      <Panel>
        <div className={s.empty}>{t('mcp.noMcp')}</div>
      </Panel>
    );
  }

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard label={t('mcp.totalCalls')} value={String(mcp.totalMcpCalls)} />
        <StatCard
          label={t('mcp.mcpPct')}
          value={fmtPct(mcp.mcpPct)}
          sub={t('tools.pctOfTotal', {pct: (mcp.mcpPct * 100).toFixed(1)})}
        />
        <StatCard
          label={t('mcp.errorRate')}
          value={fmtPct(mcp.totalMcpCalls > 0 ? mcp.totalMcpErrors / mcp.totalMcpCalls : 0)}
          sub={t('tools.nFailed', {count: mcp.totalMcpErrors})}
          color={mcp.totalMcpErrors > 0 ? 'var(--danger)' : undefined}
        />
        <StatCard label={t('mcp.avgDuration')} value={fmtDur(mcp.avgMcpDurationMs)} />
      </CardGrid>

      {/* Calls by Method */}
      {methodChartData.length > 0 && (
        <ChartBox title={t('mcp.callsByServer')}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={methodChartData} layout="vertical" margin={{top: 4, right: 12, bottom: 4, left: 120}}>
              <CartesianGrid horizontal={false} stroke={gridStroke()} strokeDasharray="3 3" />
              <XAxis type="number" tick={axisTickStyle()} />
              <YAxis type="category" dataKey="name" tick={axisTickStyle()} width={110} />
              <Tooltip
                contentStyle={tooltipStyle()}
                labelStyle={tooltipLabelStyle()}
                itemStyle={tooltipItemStyle()}
                cursor={cursorStyle()}
              />
              <Bar dataKey="calls" fill="var(--accent)" radius={[0, 4, 4, 0]} name={t('mcp.calls')} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

      {/* Server Performance Table */}
      {methodData.length > 0 && (
        <ChartBox title={t('mcp.serverPerformance')}>
          <table className={s.serverTable}>
            <thead>
              <tr>
                <th>{t('mcp.server')}</th>
                <th>{t('mcp.calls')}</th>
                <th>{t('mcp.errors')}</th>
                <th>{t('mcp.avgMs')}</th>
                <th>{t('mcp.totalMs')}</th>
              </tr>
            </thead>
            <tbody>
              {methodData
                .filter((m, idx, arr) => arr.findIndex((x) => x.server === m.server) === idx)
                .map((srv) => (
                  <tr key={srv.server}>
                    <td className={s.serverName}>{srv.server}</td>
                    <td>{srv.calls}</td>
                    <td style={{color: srv.errors > 0 ? 'var(--danger)' : undefined}}>{srv.errors}</td>
                    <td>{fmtDur(srv.avgMs)}</td>
                    <td>{fmtDur(srv.totalMs)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </ChartBox>
      )}

      {/* Method Performance Table */}
      {methodData.length > 0 && (
        <ChartBox title={t('mcp.methodPerformance')}>
          <table className={s.serverTable}>
            <thead>
              <tr>
                <th>{t('mcp.server')}</th>
                <th>{t('mcp.method')}</th>
                <th>{t('mcp.calls')}</th>
                <th>{t('mcp.errors')}</th>
                <th>{t('mcp.avgMs')}</th>
                <th>{t('mcp.totalMs')}</th>
              </tr>
            </thead>
            <tbody>
              {methodData.map((m) => (
                <tr key={`${m.server}-${m.method}`}>
                  <td className={s.serverName}>{m.server}</td>
                  <td className={s.methodName}>{m.method}</td>
                  <td>{m.calls}</td>
                  <td style={{color: m.errors > 0 ? 'var(--danger)' : undefined}}>{m.errors}</td>
                  <td>{fmtDur(m.avgMs)}</td>
                  <td>{fmtDur(m.totalMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartBox>
      )}

      {/* Turn-level MCP usage checklist */}
      {mcp.turnUsage.length > 0 && (
        <ChartBox title={t('mcp.turnsWithMcp')}>
          <div className={s.turnList}>
            {mcp.turnUsage.map((tu) => (
              <div key={tu.turnId} className={s.turnItem}>
                <div className={s.turnHeader}>
                  <span className={s.turnLabel}>{t('mcp.turnNumber', {id: tu.turnId})}</span>
                  <span className={s.turnCount}>{t('mcp.mcpCallsInTurn', {count: tu.calls.length})}</span>
                </div>
                <div className={s.turnCalls}>
                  {tu.calls.map((c, i) => (
                    <span key={i} className={s.turnCall}>
                      <span className={c.isErr ? s.callErr : s.callOk}>
                        {c.server}.{c.method}
                      </span>
                      {c.durMs > 0 && <span className={s.callDur}> ({fmtDur(c.durMs)})</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ChartBox>
      )}
    </Panel>
  );
}
