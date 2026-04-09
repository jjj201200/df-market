import {useEffect} from 'react';
import clsx from 'clsx';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import AnalyticsPage from './AnalyticsPage';
import s from './AnalyticsDrawer.module.scss';

export default function AnalyticsDrawer() {
  const drawerOpen = useAnalyticsStore((st) => st.drawerOpen);
  const closeDrawer = useAnalyticsStore((st) => st.closeDrawer);

  // Escape key to close
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  // Lock body scroll when open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <>
      <div
        className={clsx(s.backdrop, drawerOpen && s.open)}
        onClick={closeDrawer}
      />
      <div className={clsx(s.drawer, drawerOpen && s.open)}>
        <div className={s.header}>
          <span className={s.title}>Session Analytics</span>
          <button className={s.closeBtn} onClick={closeDrawer}>
            ✕
          </button>
        </div>
        <div className={s.body}>
          <AnalyticsPage />
        </div>
      </div>
    </>
  );
}
