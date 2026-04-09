import {useEffect} from 'react';
import StickyChart from './components/StickyChart/StickyChart';
import {ConversationList} from './components/ConversationList/ConversationList';
import AnalyticsDrawer from './components/Analytics/AnalyticsDrawer';
import {useSessionStore} from './stores/sessionStore';
import {useChartStore} from './stores/chartStore';
import {useAnalyticsStore} from './stores/analyticsStore';
import {useSSE} from './hooks/useSSE';
import {useScrollSync} from './hooks/useScrollSync';
import s from './App.module.scss';

export default function App() {
  const fetchSessions = useSessionStore((st) => st.fetchSessions);
  const triggerResize = useChartStore((st) => st.triggerResize);
  const splitView = useAnalyticsStore((st) => st.splitView);

  useSSE();
  useScrollSync(splitView);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Redraw charts on window resize or when split view toggles
  useEffect(() => {
    const onResize = () => triggerResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [triggerResize]);

  // Trigger chart resize when split view changes
  useEffect(() => {
    const timer = setTimeout(() => triggerResize(), 50);
    return () => clearTimeout(timer);
  }, [splitView, triggerResize]);


  if (splitView) {
    return (
      <div className={`${s.splitLayout} split-view`}>
        <div id="splitMain" className={s.splitMain}>
          <StickyChart />
          <ConversationList />
        </div>
        <AnalyticsDrawer />
      </div>
    );
  }

  return (
    <div id="splitMain" className={s.splitMain}>
      <StickyChart />
      <ConversationList />
      <AnalyticsDrawer />
    </div>
  );
}
