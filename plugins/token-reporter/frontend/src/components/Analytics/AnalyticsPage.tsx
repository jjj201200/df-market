import {useAnalyticsStore} from '../../stores/analyticsStore';
import {useSessionStore} from '../../stores/sessionStore';
import {useI18n} from '../../i18n';
import AnalyticsNav from './AnalyticsNav';
import OverviewPanel from './OverviewPanel/OverviewPanel';
import CachePanel from './CachePanel/CachePanel';
import ToolsPanel from './ToolsPanel/ToolsPanel';
import ContextPanel from './ContextPanel/ContextPanel';
import SubagentPanel from './SubagentPanel/SubagentPanel';
import TimingPanel from './TimingPanel/TimingPanel';
import McpPanel from './McpPanel/McpPanel';
import PromptPanel from './PromptPanel/PromptPanel';
import s from './AnalyticsPage.module.scss';

export default function AnalyticsPage() {
  const activeTab = useAnalyticsStore((st) => st.activeTab);
  const turns = useSessionStore((st) => st.turns);
  const {t} = useI18n();

  if (turns.length === 0) {
    return (
      <div className={s.page}>
        <div className={s.empty}>{t('error.noSessionData')}</div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <AnalyticsNav />
      <div className={s.content}>
        {activeTab === 'overview' && <OverviewPanel />}
        {activeTab === 'cache' && <CachePanel />}
        {activeTab === 'tools' && <ToolsPanel />}
        {activeTab === 'context' && <ContextPanel />}
        {activeTab === 'subagents' && <SubagentPanel />}
        {activeTab === 'timing' && <TimingPanel />}
        {activeTab === 'mcp' && <McpPanel />}
        {activeTab === 'prompt' && <PromptPanel />}
      </div>
    </div>
  );
}
