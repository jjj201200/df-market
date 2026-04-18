import {useEffect} from 'react';
import clsx from 'clsx';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import {useSessionStore} from '../../stores/sessionStore';
import {useI18n} from '../../i18n';
import Tooltip from '../common/Tooltip';
import AnalyticsNav from './AnalyticsNav';
import AnalyticsPage from './AnalyticsPage';
import s from './AnalyticsDrawer.module.scss';
import {IconX, IconLayoutColumns, IconLayoutSidebarRight} from '@tabler/icons-react';

export default function AnalyticsDrawer() {
  const drawerOpen = useAnalyticsStore((st) => st.drawerOpen);
  const splitView = useAnalyticsStore((st) => st.splitView);
  const closeDrawer = useAnalyticsStore((st) => st.closeDrawer);
  const toggleSplitView = useAnalyticsStore((st) => st.toggleSplitView);
  const hasTurns = useSessionStore((st) => st.turns.length > 0);
  const {t} = useI18n();

  // Escape key to close
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  // Lock body scroll when drawer is open (but not in split view)
  useEffect(() => {
    if (drawerOpen && !splitView) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen, splitView]);

  // In split view mode, render inline (no backdrop/fixed positioning)
  if (splitView) {
    return (
      <div className={s.splitPanel}>
        <div className={s.headerBlock}>
          <div className={s.header}>
            <span className={s.title}>{t('nav.sessionAnalytics')}</span>
            <div className={s.headerActions}>
              <Tooltip content={t('nav.exitSplitView')}>
                <button className={s.closeBtn} onClick={toggleSplitView}>
                  <IconLayoutColumns size={16} stroke={1.5} />
                </button>
              </Tooltip>
              <Tooltip content={t('common.close')}>
                <button className={s.closeBtn} onClick={closeDrawer}>
                  <IconX size={16} stroke={1.5} />
                </button>
              </Tooltip>
            </div>
          </div>
          {hasTurns && <AnalyticsNav />}
        </div>
        <div className={s.body}>
          <AnalyticsPage />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={clsx(s.backdrop, drawerOpen && s.open)} onClick={closeDrawer} />
      <div className={clsx(s.drawer, drawerOpen && s.open)}>
        <div className={s.headerBlock}>
          <div className={s.header}>
            <span className={s.title}>{t('nav.sessionAnalytics')}</span>
            <div className={s.headerActions}>
              <Tooltip content={t('nav.splitView')}>
                <button className={s.closeBtn} onClick={toggleSplitView}>
                  <IconLayoutSidebarRight size={16} stroke={1.5} />
                </button>
              </Tooltip>
              <Tooltip content={t('common.close')}>
                <button className={s.closeBtn} onClick={closeDrawer}>
                  <IconX size={16} stroke={1.5} />
                </button>
              </Tooltip>
            </div>
          </div>
          {hasTurns && <AnalyticsNav />}
        </div>
        <div className={s.body}>
          <AnalyticsPage />
        </div>
      </div>
    </>
  );
}
