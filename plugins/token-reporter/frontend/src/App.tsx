import {useEffect} from 'react';
import StickyChart from './components/StickyChart/StickyChart';
import {ConversationList} from './components/ConversationList/ConversationList';
import AnalyticsDrawer from './components/Analytics/AnalyticsDrawer';
import {useSessionStore} from './stores/sessionStore';
import {useChartStore} from './stores/chartStore';
import {useSSE} from './hooks/useSSE';
import {useScrollSync} from './hooks/useScrollSync';

export default function App() {
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const triggerResize = useChartStore((s) => s.triggerResize);

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
      <StickyChart />
      <ConversationList />
      <AnalyticsDrawer />
    </>
  );
}
