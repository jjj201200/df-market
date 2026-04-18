import {lazy, Suspense} from 'react';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import {useSessionStore} from '../../stores/sessionStore';
import {useI18n} from '../../i18n';
import AnalyticsNav from './AnalyticsNav';
import s from './AnalyticsPage.module.scss';

const OverviewPanel = lazy(() => import('./OverviewPanel/OverviewPanel'));
const CachePanel = lazy(() => import('./CachePanel/CachePanel'));
const ToolsPanel = lazy(() => import('./ToolsPanel/ToolsPanel'));
const ContextPanel = lazy(() => import('./ContextPanel/ContextPanel'));
const SubagentPanel = lazy(() => import('./SubagentPanel/SubagentPanel'));
const TimingPanel = lazy(() => import('./TimingPanel/TimingPanel'));
const McpPanel = lazy(() => import('./McpPanel/McpPanel'));
const PromptPanel = lazy(() => import('./PromptPanel/PromptPanel'));
const FilesPanel = lazy(() => import('./FilesPanel/FilesPanel'));

const PanelSkeleton = () => <div className={s.skeleton} />;

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
        <Suspense fallback={<PanelSkeleton />}>
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'cache' && <CachePanel />}
          {activeTab === 'tools' && <ToolsPanel />}
          {activeTab === 'context' && <ContextPanel />}
          {activeTab === 'subagents' && <SubagentPanel />}
          {activeTab === 'timing' && <TimingPanel />}
          {activeTab === 'mcp' && <McpPanel />}
          {activeTab === 'prompt' && <PromptPanel />}
          {activeTab === 'files' && <FilesPanel />}
        </Suspense>
      </div>
    </div>
  );
}
