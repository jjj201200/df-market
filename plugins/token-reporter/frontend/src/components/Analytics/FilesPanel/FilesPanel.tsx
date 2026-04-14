import {useMemo} from 'react';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
import {computeFileMetrics} from '../../../utils/analytics';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import TurnLink from '../common/TurnLink';
import s from './FilesPanel.module.scss';

export default function FilesPanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const files = useMemo(() => computeFileMetrics(turns), [turns]);

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard label={t('files.readEditRatio')} value={files.readEditRatio.toFixed(1)} />
        <StatCard label={t('files.totalReadFiles')} value={String(files.totalReadFiles)} />
        <StatCard label={t('files.totalEditFiles')} value={String(files.totalEditFiles)} />
        <StatCard label={t('files.totalReadOps')} value={String(files.totalReadOps)} />
        <StatCard label={t('files.totalEditOps')} value={String(files.totalEditOps)} />
        <StatCard label={t('files.bloatedGreps')} value={String(files.bloatedGreps.length)} />
      </CardGrid>

      {/* Top read files */}
      {files.topReads.length > 0 && (
        <ChartBox title={t('files.topReads')}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('files.filePath')}</th>
                <th>{t('files.readCount')}</th>
                <th>{t('files.hasOffset')}</th>
              </tr>
            </thead>
            <tbody>
              {files.topReads.map((r) => (
                <tr key={r.filePath}>
                  <td className={s.filePath} title={r.filePath}>
                    {r.filePath}
                  </td>
                  <td>{r.readCount}</td>
                  <td>{r.hasOffsetLimit ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartBox>
      )}

      {/* Bloated greps */}
      {files.bloatedGreps.length > 0 && (
        <ChartBox title={t('files.bloatedGreps')}>
          <div className={s.list}>
            {files.bloatedGreps.map((g, i) => (
              <div key={i} className={s.grepItem}>
                <span className={s.grepPattern} title={g.pattern}>
                  {g.pattern || '-'}
                </span>
                <span className={s.grepGlob} title={g.glob || ''}>
                  {g.glob || '-'}
                </span>
                <span className={s.grepLines}>
                  {g.retLines} {t('files.retLines')}
                </span>
                <span className={s.grepTurn}>
                  {t('files.turn')} <TurnLink turnId={g.turnId} />
                </span>
              </div>
            ))}
          </div>
        </ChartBox>
      )}

      {/* Read but not edited */}
      {files.unreadReads.length > 0 && (
        <ChartBox title={t('files.unreadReads')}>
          <div className={s.list}>
            {files.unreadReads.map((r) => (
              <div key={r.filePath} className={s.readItem}>
                <span className={s.readPath} title={r.filePath}>
                  {r.filePath}
                </span>
                <span className={s.readCount}>
                  {t('files.readCount')}: {r.readCount}
                </span>
              </div>
            ))}
          </div>
        </ChartBox>
      )}
    </Panel>
  );
}
