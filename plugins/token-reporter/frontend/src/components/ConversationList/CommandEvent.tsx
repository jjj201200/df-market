import React, {useCallback} from 'react';
import clsx from 'clsx';
import type {CommandItem} from '../../types/state';
import {useI18n} from '../../i18n';
import {useUIStore} from '../../stores/uiStore';
import {CopyButton} from '../common/CopyButton';
import {MarkdownContent} from '../common/MarkdownContent';
import s from './CommandEvent.module.scss';
import {IconCommand, IconTerminal2, IconChevronRight} from '@tabler/icons-react';

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

  const getOutputText = useCallback(() => item.output || '', [item.output]);

  const isBash = item.kind === 'bash';
  const displayName = isBash ? `! ${item.command}` : item.command;
  const showMessage = !isBash && item.message && item.message !== item.command.replace(/^\//, '');

  return (
    <div className={clsx(s.eventCommand, isBash && s.bash, item.isError && s.hasError)}>
      <div className={s.evCmdHead}>
        <span className={s.evCmdIcon}>
          {isBash ? <IconTerminal2 size={14} stroke={1.5} /> : <IconCommand size={14} stroke={1.5} />}
        </span>
        <span className={s.evCmdName}>{displayName}</span>
        {showMessage && <span className={s.evCmdMsg}>{item.message}</span>}
        <span className={s.evCmdTime}>{item.time}</span>
      </div>
      {hasOutput && (
        <div className={clsx(s.evCmdExpandRow, expanded && s.open)} onClick={handleToggle}>
          <span className={s.arrow}>
            <IconChevronRight size={14} stroke={1.5} />
          </span>
          <span>{t('conversation.commandOutput')}</span>
        </div>
      )}
      {hasOutput && expanded && (
        <div className={clsx(s.evCmdResultPreview, item.isError && s.isErr)}>
          <div className={s.evCmdResultText}>
            <MarkdownContent>{item.output}</MarkdownContent>
          </div>
          <CopyButton getText={getOutputText} />
        </div>
      )}
    </div>
  );
});

CommandEvent.displayName = 'CommandEvent';
