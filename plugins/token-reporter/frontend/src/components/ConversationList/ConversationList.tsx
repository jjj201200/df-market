import React from 'react';
import {useSessionStore} from '../../stores/sessionStore';
import {useI18n} from '../../i18n';
import {LoadingState} from '../common/LoadingState';
import {ErrorDisplay} from '../common/ErrorDisplay';
import {TurnItem} from './TurnItem';
import {CompactEvent} from './CompactEvent';
import {CommandEvent} from './CommandEvent';
import type {TurnItem as TurnItemType, CompactItem, CommandItem} from '../../types/state';
import s from './ConversationList.module.scss';

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

  if (sessionsLoading || sessionLoading) {
    return (
      <div className={s.convScroll}>
        <LoadingState />
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
    <div className={s.convScroll} id="convList">
      {data.map((item, idx) => {
        switch (item.type) {
          case 'turn':
            return (
              <TurnItem key={`turn-${(item as TurnItemType).id}`} turn={item as TurnItemType} subagents={subagents} />
            );
          case 'compact':
            return <CompactEvent key={`compact-${idx}`} item={item as CompactItem} />;
          case 'command':
            return <CommandEvent key={`cmd-${idx}`} item={item as CommandItem} />;
          default:
            return null;
        }
      })}
    </div>
  );
};
