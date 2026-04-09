import clsx from 'clsx';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import type {AnalyticsTab} from '../../stores/analyticsStore';
import s from './AnalyticsNav.module.scss';

const TABS: {key: AnalyticsTab; label: string; icon: string}[] = [
  {key: 'overview', label: 'Overview', icon: '$'},
  {key: 'cache', label: 'Cache', icon: '\u21bb'},
  {key: 'tools', label: 'Tools', icon: '\u2692'},
  {key: 'context', label: 'Context', icon: '\u2191'},
  {key: 'subagents', label: 'Subagents', icon: '\u2442'},
];

export default function AnalyticsNav() {
  const activeTab = useAnalyticsStore((st) => st.activeTab);
  const setActiveTab = useAnalyticsStore((st) => st.setActiveTab);

  return (
    <nav className={s.nav}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={clsx(s.tab, activeTab === tab.key && s.active)}
          onClick={() => setActiveTab(tab.key)}
        >
          <span className={s.icon}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
