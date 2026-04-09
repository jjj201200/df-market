import React from 'react';
import {useChartStore} from '../../stores/chartStore';
import {fmtF} from '../../utils/format';
import s from './TokenBadges.module.scss';

interface TokenBadgesProps {
  input: number;
  output: number;
  cacheR: number;
  cacheC: number;
}

export const TokenBadges: React.FC<TokenBadgesProps> = React.memo(({input, output, cacheR, cacheC}) => {
  const dims = useChartStore((st) => st.dims);

  const badges: React.ReactNode[] = [];
  if (dims.input && input) {
    badges.push(
      <span className={s.tok} key="in">
        <span className={s.tl}>IN </span>
        <span className={s.tvIn}>{fmtF(input)}</span>
      </span>,
    );
  }
  if (dims.output && output) {
    badges.push(
      <span className={s.tok} key="out">
        <span className={s.tl}>OUT </span>
        <span className={s.tvOut}>{fmtF(output)}</span>
      </span>,
    );
  }
  if (dims.cacheR && cacheR) {
    badges.push(
      <span className={s.tok} key="cr">
        <span className={s.tl}>CR </span>
        <span className={s.tvCr}>{fmtF(cacheR)}</span>
      </span>,
    );
  }
  if (dims.cacheC && cacheC) {
    badges.push(
      <span className={s.tok} key="cc">
        <span className={s.tl}>CC </span>
        <span className={s.tvCc}>{fmtF(cacheC)}</span>
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return <div className={s.msgTokens}>{badges}</div>;
});

TokenBadges.displayName = 'TokenBadges';
