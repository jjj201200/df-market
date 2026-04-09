import {useAnalyticsStore} from '../../stores/analyticsStore';
import {useSessionStore} from '../../stores/sessionStore';
import AnalyticsNav from './AnalyticsNav';
import OverviewPanel from './OverviewPanel/OverviewPanel';
import CachePanel from './CachePanel/CachePanel';
import ToolsPanel from './ToolsPanel/ToolsPanel';
import ContextPanel from './ContextPanel/ContextPanel';
import SubagentPanel from './SubagentPanel/SubagentPanel';
import s from './AnalyticsPage.module.scss';

export default function AnalyticsPage() {
  const activeTab = useAnalyticsStore((st) => st.activeTab);
  const turns = useSessionStore((st) => st.turns);

  if (turns.length === 0) {
    return (
      <div className={s.page}>
        <div className={s.empty}>No session data loaded. Select a session to analyze.</div>
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
      </div>
    </div>
  );
}
