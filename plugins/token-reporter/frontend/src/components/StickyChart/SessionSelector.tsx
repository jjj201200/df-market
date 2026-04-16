import {useCallback, useMemo} from 'react';
import {useSessionStore} from '../../stores/sessionStore';
import Dropdown from '../common/Dropdown';
import type {DropdownOption} from '../common/Dropdown';
import Tooltip from '../common/Tooltip';
import {useI18n} from '../../i18n';
import styles from './SessionSelector.module.scss';

export default function SessionSelector() {
  const {t} = useI18n();
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loadSession = useSessionStore((s) => s.loadSession);
  const newSessionIds = useSessionStore((s) => s.newSessionIds);

  const sessionOptions: DropdownOption[] = useMemo(
    () =>
      sessions.map((s) => {
        const time = `${s.mtime.slice(0, 10)} ${s.mtime.slice(11, 16)}`;
        const title = s.customTitle || s.slug || s.sessionId;
        const shortId = s.sessionId.slice(0, 8);
        return {
          value: s.sessionId,
          label: `${time} \u00b7 ${title}`,
          sub: shortId,
          isNew: newSessionIds.has(s.sessionId),
        };
      }),
    [sessions, newSessionIds],
  );

  const handleSessionChange = useCallback(
    (val: string) => {
      loadSession(val);
    },
    [loadSession],
  );

  const handleCopy = useCallback(() => {
    if (!activeSessionId) return;
    navigator.clipboard.writeText(activeSessionId).then(() => {
      // no-op: no visual feedback needed in compact header
    });
  }, [activeSessionId]);

  return (
    <div className={styles.sessionSelector}>
      <div className={styles.dropdownWrap}>
        <Dropdown
          options={sessionOptions}
          value={activeSessionId ?? ''}
          onChange={handleSessionChange}
          size="sm"
          maxHeight={320}
          matchWidth
          className={styles.dropdown}
        />
        {newSessionIds.size > 0 && (
          <span className={styles.newBadge}>{newSessionIds.size > 9 ? '9+' : newSessionIds.size}</span>
        )}
      </div>
      <Tooltip content={t('session.copySessionId')}>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {t('session.copyId')}
        </button>
      </Tooltip>
    </div>
  );
}
