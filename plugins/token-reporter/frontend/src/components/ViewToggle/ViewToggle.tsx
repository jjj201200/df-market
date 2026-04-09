import clsx from 'clsx';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import type {AnalyticsView} from '../../stores/analyticsStore';
import s from './ViewToggle.module.scss';

const TABS: {key: AnalyticsView; label: string}[] = [
  {key: 'session', label: 'Session'},
  {key: 'analytics', label: 'Analytics'},
];

export default function ViewToggle() {
  const activeView = useAnalyticsStore((st) => st.activeView);
  const setActiveView = useAnalyticsStore((st) => st.setActiveView);

  return (
    <div className={s.bar}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={clsx(s.tab, activeView === tab.key && s.active)}
          onClick={() => setActiveView(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
