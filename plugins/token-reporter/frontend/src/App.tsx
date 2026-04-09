import {useEffect, useRef, useLayoutEffect} from 'react';
import StickyChart from './components/StickyChart/StickyChart';
import {ConversationList} from './components/ConversationList/ConversationList';
import AnalyticsDrawer from './components/Analytics/AnalyticsDrawer';
import {useSessionStore} from './stores/sessionStore';
import {useChartStore} from './stores/chartStore';
import {useAnalyticsStore} from './stores/analyticsStore';
import {useSSE} from './hooks/useSSE';
import {useScrollSync, getScrollContainer} from './hooks/useScrollSync';
import s from './App.module.scss';

export default function App() {
  const fetchSessions = useSessionStore((st) => st.fetchSessions);
  const triggerResize = useChartStore((st) => st.triggerResize);
  const splitView = useAnalyticsStore((st) => st.splitView);
  const prevSplitView = useRef(splitView);

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

  // Preserve scroll position across split view toggles:
  // Before DOM switches, save the first visible turn index.
  // After DOM re-renders, scroll the new container to that turn.
  useLayoutEffect(() => {
    if (prevSplitView.current !== splitView) {
      const {viewLoIdx} = useChartStore.getState();
      const turns = useSessionStore.getState().turns;
      prevSplitView.current = splitView;

      // After layout, scroll to the saved turn
      requestAnimationFrame(() => {
        if (viewLoIdx >= 0 && turns.length > 0) {
          const turn = turns[viewLoIdx];
          if (turn) {
            const el = document.getElementById('turn-' + turn.id);
            if (el) {
              const container = getScrollContainer();
              const stickyEl = document.getElementById('stickyChart');
              const stickyH = stickyEl?.offsetHeight || 0;
              const elTop = el.offsetTop;
              container.scrollTop = elTop - stickyH;
            }
          }
        }
        triggerResize();
      });
    }
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
