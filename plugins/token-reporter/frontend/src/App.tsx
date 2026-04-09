import {useEffect} from 'react';
import StickyChart from './components/StickyChart/StickyChart';
import {ConversationList} from './components/ConversationList/ConversationList';
import ViewToggle from './components/ViewToggle/ViewToggle';
import AnalyticsPage from './components/Analytics/AnalyticsPage';
import {useSessionStore} from './stores/sessionStore';
import {useChartStore} from './stores/chartStore';
import {useAnalyticsStore} from './stores/analyticsStore';
import {useSSE} from './hooks/useSSE';
import {useScrollSync} from './hooks/useScrollSync';

export default function App() {
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const triggerResize = useChartStore((s) => s.triggerResize);
  const activeView = useAnalyticsStore((s) => s.activeView);

  useSSE();
  useScrollSync();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Redraw charts on window resize
  useEffect(() => {
    const onResize = () => triggerResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [triggerResize]);

  return (
    <>
      <ViewToggle />
      {activeView === 'session' ? (
        <>
          <StickyChart />
          <ConversationList />
        </>
      ) : (
        <AnalyticsPage />
      )}
    </>
  );
}
