import clsx from 'clsx';
import {
  IconChartPie,
  IconRefresh,
  IconTools,
  IconLayersIntersect,
  IconStack,
  IconClockHour4,
  IconBolt,
  IconPencil,
} from '@tabler/icons-react';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import type {AnalyticsTab} from '../../stores/analyticsStore';
import {useI18n} from '../../i18n';
import type {TranslationKey} from '../../i18n';
import s from './AnalyticsNav.module.scss';

const TABS: {key: AnalyticsTab; labelKey: TranslationKey; icon: React.ReactNode}[] = [
  {key: 'overview', labelKey: 'nav.overview', icon: <IconChartPie size={14} />},
  {key: 'cache', labelKey: 'nav.cache', icon: <IconRefresh size={14} />},
  {key: 'tools', labelKey: 'nav.tools', icon: <IconTools size={14} />},
  {key: 'context', labelKey: 'nav.context', icon: <IconStack size={14} />},
  {key: 'subagents', labelKey: 'nav.subagents', icon: <IconLayersIntersect size={14} />},
  {key: 'timing', labelKey: 'nav.timing', icon: <IconClockHour4 size={14} />},
  {key: 'mcp', labelKey: 'nav.mcp', icon: <IconBolt size={14} />},
  {key: 'prompt', labelKey: 'nav.prompt', icon: <IconPencil size={14} />},
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
