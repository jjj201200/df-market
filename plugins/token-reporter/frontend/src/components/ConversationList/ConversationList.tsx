import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
import {useSessionStore} from '../../stores/sessionStore';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import {useI18n} from '../../i18n';
import {LoadingState} from '../common/LoadingState';
import {ErrorDisplay} from '../common/ErrorDisplay';
import {TurnItem} from './TurnItem';
import {CompactEvent} from './CompactEvent';
import {CommandEvent} from './CommandEvent';
import {setConversationVirtualizer} from '../../utils/virtualList';
import type {TurnItem as TurnItemType, CompactItem, CommandItem, DataItem} from '../../types/state';
import s from './ConversationList.module.scss';

/** Rows rendered beyond the viewport, each side (turns are tall — keep modest) */
const OVERSCAN = 5;
/** Initial per-type height estimates (px), corrected by measureElement */
const EST_TURN = 220;
const EST_EVENT = 44;
/** Must match .convScroll's padding-top — shifts the virtual coordinate origin */
const TOP_PAD = 12;

function renderRow(item: DataItem, subagents: Record<string, import('../../types/state').SubagentStats>) {
  switch (item.type) {
    case 'turn':
      return <TurnItem turn={item as TurnItemType} subagents={subagents} />;
    case 'compact':
      return <CompactEvent item={item as CompactItem} />;
    case 'command':
      return <CommandEvent item={item as CommandItem} />;
    default:
      return null;
  }
}

export const ConversationList: React.FC = () => {
  const {t} = useI18n();
  const data = useSessionStore((st) => st.data);
  const subagents = useSessionStore((st) => st.subagents);
  const sessions = useSessionStore((st) => st.sessions);
  const sessionsLoading = useSessionStore((st) => st.sessionsLoading);
  const sessionsError = useSessionStore((st) => st.sessionsError);
  const activeSessionId = useSessionStore((st) => st.activeSessionId);
  const sessionLoading = useSessionStore((st) => st.sessionLoading);
  const sessionError = useSessionStore((st) => st.sessionError);
  const loadProgress = useSessionStore((st) => st.loadProgress);
  const splitView = useAnalyticsStore((st) => st.splitView);

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Virtualizer must be created unconditionally (hook rules); count 0 is safe
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => document.getElementById('splitMain'),
    estimateSize: (i) => (data[i]?.type === 'turn' ? EST_TURN : EST_EVENT),
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey: (i) => {
      const d = data[i]!;
      return d.type === 'turn' ? `turn-${d.id}` : `${d.type}-${i}`;
    },
  });

  // Expose the instance to the scroll<->brush sync (plain-function modules)
  useEffect(() => {
    setConversationVirtualizer(virtualizer);
    return () => setConversationVirtualizer(null);
  }, [virtualizer]);

  // scrollMargin = offset of data[0] from the top of the scroll container's
  // content: list offsetTop + the container's own top padding. It shifts when
  // the sticky chart's height changes (loading <-> data, media queries), so a
  // ResizeObserver tracks the chart and every view switch re-measures.
  const measureMargin = useCallback(() => {
    const el = listRef.current;
    if (el) setScrollMargin(el.offsetTop + TOP_PAD);
  }, []);

  useLayoutEffect(() => {
    measureMargin();
  }, [measureMargin, data, splitView, activeSessionId, sessionLoading, sessionsLoading]);

  useEffect(() => {
    const sticky = document.getElementById('stickyChart');
    if (!sticky || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureMargin());
    ro.observe(sticky);
    return () => ro.disconnect();
  }, [measureMargin, splitView, activeSessionId]);

  if (sessionsLoading || sessionLoading) {
    const showProgress = sessionLoading && !sessionsLoading && loadProgress != null;
    return (
      <div className={s.convScroll}>
        {showProgress ? (
          <div className={s.loadProgress}>
            <div className={s.loadProgressText}>{t('session.loadingProgress', {pct: loadProgress})}</div>
            <div className={s.loadProgressBar}>
              <div className={s.loadProgressFill} style={{width: `${loadProgress}%`}} />
            </div>
          </div>
        ) : (
          <LoadingState />
        )}
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div className={s.convScroll}>
        <ErrorDisplay message={t('error.failedLoadSessions')} detail={sessionsError} />
      </div>
    );
  }

  if (!activeSessionId) {
    if (sessions.length === 0 && !sessionsLoading) {
      return (
        <div className={s.convScroll}>
          <ErrorDisplay message={t('error.noSessions')} />
        </div>
      );
    }
    return (
      <div className={s.convScroll}>
        <LoadingState />
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className={s.convScroll}>
        <ErrorDisplay message={t('error.failedLoadSession')} detail={sessionError} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={s.convScroll}>
        <ErrorDisplay message={t('error.noData')} />
      </div>
    );
  }

  return (
    <div className={s.convScroll} id="convList" ref={listRef}>
      <div className={s.spacer} style={{height: virtualizer.getTotalSize()}}>
        {virtualizer.getVirtualItems().map((vi) => {
          const item = data[vi.index];
          if (!item) return null;
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className={s.vrow}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start - scrollMargin}px)`,
              }}
            >
              {renderRow(item, subagents)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
