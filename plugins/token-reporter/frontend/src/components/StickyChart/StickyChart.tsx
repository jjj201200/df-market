import {useMemo, useRef, useEffect, useCallback} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore} from '../../stores/sessionStore';
import {useAnalyticsStore} from '../../stores/analyticsStore';
import {useI18n} from '../../i18n';
import {useI18nStore} from '../../stores/i18nStore';
import Dropdown from '../common/Dropdown';
import type {DropdownOption} from '../common/Dropdown';
import Tooltip from '../common/Tooltip';
import DimBar from './DimBar';
import SessionBar from './SessionBar';
import SessionSelector from './SessionSelector';
import MainChart from './MainChart';
import BrushChart from './BrushChart';
import BrushOverlay from './BrushOverlay';
import {brushToFirstIdx, brushToLastIdx} from '../../utils/brushCoords';
// import ChartLegend from './ChartLegend';
import LimitsDisplay from './LimitsDisplay';
import styles from './StickyChart.module.scss';
import {IconExternalLink} from '@tabler/icons-react';

export default function StickyChart() {
  const {t, locale} = useI18n();
  const setLocale = useI18nStore((s) => s.setLocale);
  const turns = useSessionStore((s) => s.turns);
  const sessionLoading = useSessionStore((s) => s.sessionLoading);

  const langOptions: DropdownOption[] = useMemo(
    () => [
      {value: 'en', label: 'EN'},
      {value: 'zh-CN', label: '中文'},
    ],
    [],
  );
  const handleLocaleChange = useCallback((val: string) => setLocale(val as 'en' | 'zh-CN'), [setLocale]);
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);
  const toggleDrawer = useAnalyticsStore((s) => s.toggleDrawer);
  const drawerOpen = useAnalyticsStore((s) => s.drawerOpen);
  const splitView = useAnalyticsStore((s) => s.splitView);

  const rangeLabel = useMemo(() => {
    const N = turns.length;
    if (N === 0) return '';
    const lo = brushToFirstIdx(brushL, N);
    const hi = brushToLastIdx(brushR, N);
    const first = turns[lo];
    const last = turns[hi];
    if (!first || !last) return '';
    return t('chart.requestRange', {first: first.id, last: last.id});
  }, [turns, brushL, brushR, t]);

  const chartAreaRef = useRef<HTMLDivElement>(null);

  // Attach native non-passive wheel listener to prevent page scroll
  // when wheeling over the chart area. React onWheel is passive by default
  // and cannot call preventDefault().
  useEffect(() => {
    const stop = (e: WheelEvent) => {
      e.preventDefault();
    };
    const el = chartAreaRef.current;
    el?.addEventListener('wheel', stop, {passive: false});
    return () => el?.removeEventListener('wheel', stop);
  }, []);

  return (
    <div id="stickyChart" className={styles.stickyChart}>
      <div className={styles.titleBar}>
        <div className={styles.title}>
          TOKEN REPORTER ❤️ <span>DF</span>
          <span className={styles.version}>v{__PLUGIN_VERSION__}</span>
          <Dropdown
            options={langOptions}
            value={locale}
            onChange={handleLocaleChange}
            size="sm"
            className={styles.langDropdown}
          />
        </div>
        <SessionSelector />
        {!drawerOpen && !splitView && (
          <Tooltip content={t('nav.sessionAnalytics')} placement="bottom">
            <button className={styles.analyticsBtn} onClick={toggleDrawer}>
              {t('nav.analytics')} <IconExternalLink size={12} stroke={1.5} style={{verticalAlign: 'middle'}} />
            </button>
          </Tooltip>
        )}
      </div>

      <SessionBar />

      {sessionLoading ? (
        <>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitleText}>{t('chart.tokenUsage')}</span>
            <div className={styles.skChartHeader} />
          </div>
          <div className={styles.chartArea}>
            <div className={styles.mainChartScroll}>
              <div className={styles.skMainChart} />
            </div>
            <div className={styles.skBrushWrap}>
              <div className={styles.skBrushChart} />
            </div>
          </div>
          <div className={styles.bottomRow}>
            <div className={styles.skLimits} />
            <DimBar />
          </div>
        </>
      ) : (
        <>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitleText}>{t('chart.tokenUsage')}</span>
            {rangeLabel && <span className={styles.rangeLabel}>{rangeLabel}</span>}
          </div>

          <div ref={chartAreaRef} className={styles.chartArea}>
            <div className={styles.mainChartScroll}>
              <MainChart />
            </div>

            <div className={styles.brushWrap}>
              <BrushChart />
              <BrushOverlay />
            </div>
          </div>

          {/* <ChartLegend /> */}

          <div className={styles.bottomRow}>
            <LimitsDisplay />
            <DimBar />
          </div>
        </>
      )}
    </div>
  );
}
