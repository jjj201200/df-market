import React, {useState, useCallback} from 'react';
import type {CommandItem} from '../../types/state';
import s from './CommandEvent.module.scss';

interface CommandEventProps {
  item: CommandItem;
}

export const CommandEvent: React.FC<CommandEventProps> = React.memo(({item}) => {
  const [showOutput, setShowOutput] = useState(false);
  const hasOutput = (item.output || '').trim().length > 0;

  const handleToggle = useCallback(() => {
    setShowOutput((prev) => !prev);
  }, []);

  const showMessage = item.message && item.message !== item.command.replace(/^\//, '');

  return (
    <div className={s.eventCommand}>
      <span className={s.evCmdIcon}>&#8984;</span>
      <span className={s.evCmdName}>{item.command}</span>
      {showMessage && <span className={s.evCmdMsg}>{item.message}</span>}
      <span className={s.evCmdTime}>{item.time}</span>
      {hasOutput && (
        <span className={s.evCmdToggle} onClick={handleToggle}>
          {showOutput ? '▼ output' : '▶ output'}
        </span>
      )}
      {hasOutput && showOutput && <div className={s.evCmdOutput}>{item.output}</div>}
    </div>
  );
});

CommandEvent.displayName = 'CommandEvent';
