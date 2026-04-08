import React from 'react';
import {useSessionStore} from '../../stores/sessionStore';
import {LoadingState} from '../common/LoadingState';
import {ErrorDisplay} from '../common/ErrorDisplay';
import {TurnItem} from './TurnItem';
import {CompactEvent} from './CompactEvent';
import {CommandEvent} from './CommandEvent';
import type {TurnItem as TurnItemType, CompactItem, CommandItem} from '../../types/state';
import s from './ConversationList.module.scss';

export const ConversationList: React.FC = () => {
  const data = useSessionStore((st) => st.data);
  const subagents = useSessionStore((st) => st.subagents);
  const sessionLoading = useSessionStore((st) => st.sessionLoading);
  const sessionError = useSessionStore((st) => st.sessionError);

  if (sessionLoading) {
    return (
      <div className={s.convScroll}>
        <LoadingState />
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className={s.convScroll}>
        <ErrorDisplay message="Failed to load session" detail={sessionError} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={s.convScroll}>
        <ErrorDisplay message="No data for this session" />
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
