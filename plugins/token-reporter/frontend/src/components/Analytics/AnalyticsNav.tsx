import clsx from 'clsx';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import type {AnalyticsTab} from '../../stores/analyticsStore';
import {useI18n} from '../../i18n';
import type {TranslationKey} from '../../i18n';
import s from './AnalyticsNav.module.scss';

const TABS: {key: AnalyticsTab; labelKey: TranslationKey; icon: string}[] = [
  {key: 'overview', labelKey: 'nav.overview', icon: '$'},
  {key: 'cache', labelKey: 'nav.cache', icon: '\u21bb'},
  {key: 'tools', labelKey: 'nav.tools', icon: '\u2692'},
  {key: 'context', labelKey: 'nav.context', icon: '\u2191'},
  {key: 'subagents', labelKey: 'nav.subagents', icon: '\u2442'},
  {key: 'timing', labelKey: 'nav.timing', icon: '\u23F1'},
  {key: 'mcp', labelKey: 'nav.mcp', icon: '\u26A1'},
];

export default function AnalyticsNav() {
  const activeTab = useAnalyticsStore((st) => st.activeTab);
  const setActiveTab = useAnalyticsStore((st) => st.setActiveTab);
  const {t} = useI18n();

  return (
    <nav className={s.nav}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={clsx(s.tab, activeTab === tab.key && s.active)}
          onClick={() => setActiveTab(tab.key)}
        >
          <span className={s.icon}>{tab.icon}</span>
          {t(tab.labelKey)}
        </button>
      ))}
    </nav>
  );
}
