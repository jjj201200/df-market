import React, {useCallback, useState, useRef} from 'react';
import s from './CopyButton.module.scss';

interface CopyButtonProps {
  getText: () => string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({getText, className}) => {
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
    <button className={`${s.copyBtn} ${copied ? s.copied : ''} ${className ?? ''}`} onClick={handleClick} title="Copy">
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};
