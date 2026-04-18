import {useEffect, useRef, useLayoutEffect, useState, useCallback} from 'react';
import StickyChart from './components/StickyChart/StickyChart';
import {ConversationList} from './components/ConversationList/ConversationList';
import AnalyticsDrawer from './components/Analytics/AnalyticsDrawer';
import {useSessionStore} from './stores/sessionStore';
import {useChartStore} from './stores/chartStore';
import {useAnalyticsStore, getInitialSplitWidth, persistSplitWidth} from './stores/analyticsStore';
import {useSSE} from './hooks/useSSE';
import {useScrollSync, getScrollContainer} from './hooks/useScrollSync';
import s from './App.module.scss';

const MIN_PANEL_WIDTH = 700;
const THROTTLE_MS = 32; // ~30fps

function throttle<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

export default function App() {
  const fetchSessions = useSessionStore((st) => st.fetchSessions);
  const triggerResize = useChartStore((st) => st.triggerResize);
  const splitView = useAnalyticsStore((st) => st.splitView);
  const prevSplitView = useRef(splitView);
  const [leftWidth, setLeftWidth] = useState(() => getInitialSplitWidth());
  const [isDragging, setIsDragging] = useState(false);

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

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = throttle((e: MouseEvent) => {
      const maxWidth = window.innerWidth - MIN_PANEL_WIDTH;
      const nextWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, e.clientX));
      setLeftWidth(nextWidth);
    }, THROTTLE_MS);

    const handleMouseUp = () => {
      setIsDragging(false);
      persistSplitWidth(leftWidth);
      triggerResize();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isDragging, leftWidth, triggerResize]);

  if (splitView) {
    return (
      <div className={`${s.splitLayout} split-view`}>
        <div id="splitMain" className={s.splitMain} style={{width: leftWidth, flex: 'none'}}>
          {isDragging ? (
            <div className={`${s.dragSkeleton} ${s.dragSkeletonLeft}`}>
              <div className={s.dragSkeletonBar} />
              <div className={s.dragSkeletonList}>
                {Array.from({length: 12}, (_, i) => (
                  <div className={s.dragSkeletonRow} key={i}>
                    <div className={s.dragSkeletonBadge} />
                    <div className={s.dragSkeletonLine} style={{width: `${40 + (i % 3) * 20}%`}} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <StickyChart />
              <ConversationList />
            </>
          )}
        </div>
        <div className={s.resizer} onMouseDown={handleMouseDown} />
        <div className={s.splitRight} style={{flex: 1, minWidth: 0}}>
          {isDragging ? (
            <div className={`${s.dragSkeleton} ${s.dragSkeletonRight}`}>
              <div className={s.dragSkeletonBar} />
              <div className={s.dragSkeletonCards}>
                {Array.from({length: 6}, (_, i) => (
                  <div className={s.dragSkeletonCard} key={i} />
                ))}
              </div>
              <div className={s.dragSkeletonChart} />
              <div className={s.dragSkeletonChart} />
            </div>
          ) : (
            <AnalyticsDrawer />
          )}
        </div>
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
