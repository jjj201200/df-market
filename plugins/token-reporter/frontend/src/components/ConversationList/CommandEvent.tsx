import React, {useCallback} from 'react';
import clsx from 'clsx';
import type {CommandItem} from '../../types/state';
import {useI18n} from '../../i18n';
import {useUIStore} from '../../stores/uiStore';
import s from './CommandEvent.module.scss';

interface CommandEventProps {
  item: CommandItem;
}

export const CommandEvent: React.FC<CommandEventProps> = React.memo(({item}) => {
  const {t} = useI18n();
  const cmdId = `cmd-${item.command}-${item.timestamp}`;
  const expanded = useUIStore((st) => st.expandedCommands.has(cmdId));
  const toggleCommand = useUIStore((st) => st.toggleCommand);
  const hasOutput = (item.output || '').trim().length > 0;

  const handleToggle = useCallback(() => {
    toggleCommand(cmdId);
  }, [cmdId, toggleCommand]);

  const showMessage = item.message && item.message !== item.command.replace(/^\//, '');

  return (
    <div className={s.eventCommand}>
      <div className={s.evCmdHead}>
        <span className={s.evCmdIcon}>&#8984;</span>
        <span className={s.evCmdName}>{item.command}</span>
        {showMessage && <span className={s.evCmdMsg}>{item.message}</span>}
        <span className={s.evCmdTime}>{item.time}</span>
      </div>
      {hasOutput && (
        <div className={clsx(s.evCmdExpandRow, expanded && s.open)} onClick={handleToggle}>
          <span className={s.arrow}>&#9654;</span>
          <span>{t('conversation.commandOutput')}</span>
        </div>
      )}
      {hasOutput && expanded && <div className={s.evCmdOutput}>{item.output}</div>}
    </div>
  );
});

CommandEvent.displayName = 'CommandEvent';
