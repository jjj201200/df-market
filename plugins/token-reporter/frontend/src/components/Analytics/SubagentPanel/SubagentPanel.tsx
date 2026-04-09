import {useMemo} from 'react';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeSubagentEfficiency} from '../../../utils/analytics';
import {fmtUsd, fmtTokens, fmtPct as pct} from '../../../utils/format';
import {useI18n} from '../../../i18n';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import StatCard from '../common/StatCard';
import s from './SubagentPanel.module.scss';

export default function SubagentPanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const subagents = useSessionStore((st) => st.subagents);
  const sa = useMemo(() => computeSubagentEfficiency(subagents, turns), [subagents, turns]);

  if (sa.agents.length === 0) {
    return (
      <Panel>
        <div className={s.empty}>{t('subagents.noSubagents')}</div>
      </Panel>
    );
  }

  return (
    <Panel>
      <CardGrid>
        <StatCard label={t('subagents.mainSessionCost')} value={fmtUsd(sa.mainTokens.cost)} sub={t('subagents.nTurns', {count: sa.mainTokens.turns})} />
        <StatCard label={t('subagents.totalSubagentCost')} value={fmtUsd(sa.totalSubagentCost)} sub={t('subagents.nAgents', {count: sa.agents.length})} />
        <StatCard
          label={t('subagents.subagentCostPct')}
          value={pct(sa.subagentCostPct)}
          color={sa.subagentCostPct > 0.5 ? 'var(--warning)' : undefined}
        />
      </CardGrid>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('subagents.agent')}</th>
              <th>{t('subagents.type')}</th>
              <th>{t('subagents.turns')}</th>
              <th>{t('subagents.input')}</th>
              <th>{t('subagents.output')}</th>
              <th>{t('subagents.cacheR')}</th>
              <th>{t('subagents.cacheC')}</th>
              <th>{t('subagents.cost')}</th>
              <th>{t('subagents.tokPerTurn')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className={s.mainRow}>
              <td>{t('subagents.mainSession')}</td>
              <td>{t('subagents.na')}</td>
              <td>{sa.mainTokens.turns}</td>
              <td>{fmtTokens(sa.mainTokens.input)}</td>
              <td>{fmtTokens(sa.mainTokens.output)}</td>
              <td>{fmtTokens(sa.mainTokens.cacheR)}</td>
              <td>{fmtTokens(sa.mainTokens.cacheC)}</td>
              <td>{fmtUsd(sa.mainTokens.cost)}</td>
              <td>
                {sa.mainTokens.turns > 0
                  ? fmtTokens(
                      (sa.mainTokens.input + sa.mainTokens.output + sa.mainTokens.cacheR + sa.mainTokens.cacheC) /
                        sa.mainTokens.turns
                    )
                  : t('subagents.na')}
              </td>
            </tr>
            {sa.agents.map((a) => (
              <tr key={a.agentId}>
                <td title={a.description}>{a.agentId.slice(0, 8)}</td>
                <td>{a.agentType || t('subagents.na')}</td>
                <td>{a.turns}</td>
                <td>{fmtTokens(a.tokens.input)}</td>
                <td>{fmtTokens(a.tokens.output)}</td>
                <td>{fmtTokens(a.tokens.cacheR)}</td>
                <td>{fmtTokens(a.tokens.cacheC)}</td>
                <td>{fmtUsd(a.cost)}</td>
                <td>{fmtTokens(a.tokensPerTurn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
