import React, {useCallback, useState, useRef} from 'react';
import clsx from 'clsx';
import {useI18n} from '../../i18n';
import Tooltip from './Tooltip';
import s from './CopyButton.module.scss';

interface CopyButtonProps {
  getText: () => string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({getText, className}) => {
  const {t} = useI18n();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [getText]);

  return (
    <Tooltip content={copied ? t('common.copied') : t('common.copy')}>
      <button className={clsx(s.copyBtn, copied && s.copied, className)} onClick={handleClick}>
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </Tooltip>
  );
};
