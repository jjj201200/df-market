export function parseSlashCommandContent(content: unknown): { command: string; message: string } | null {
  if (typeof content !== 'string') return null;
  const cmdMatch = content.match(/<command-name>([^<]+)<\/command-name>/);
  if (!cmdMatch) return null;
  const msgMatch = content.match(/<command-message>([^<]*)<\/command-message>/);
  return {
    command: cmdMatch[1].trim(),
    message: (msgMatch?.[1] || '').trim(),
  };
}

export function parseLocalCommandStdout(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  const m = content.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/);
  return m ? m[1] : null;
}

export function isLocalCommandCaveat(content: unknown): boolean {
  return typeof content === 'string' && /<local-command-caveat>/.test(content);
}

export function parseBashInputContent(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  const m = content.match(/<bash-input>([\s\S]*?)<\/bash-input>/);
  return m ? m[1] : null;
}

export function parseBashOutputContent(content: unknown): { stdout: string; stderr: string } | null {
  if (typeof content !== 'string') return null;
  const outMatch = content.match(/<bash-stdout>([\s\S]*?)<\/bash-stdout>/);
  const errMatch = content.match(/<bash-stderr>([\s\S]*?)<\/bash-stderr>/);
  if (!outMatch && !errMatch) return null;
  return {
    stdout: outMatch ? outMatch[1] : '',
    stderr: errMatch ? errMatch[1] : '',
  };
}

export function isSlashCommandWrapperContent(content: unknown): boolean {
  if (typeof content !== 'string') return false;
  return (
    parseSlashCommandContent(content) !== null ||
    parseLocalCommandStdout(content) !== null ||
    isLocalCommandCaveat(content) ||
    parseBashInputContent(content) !== null ||
    parseBashOutputContent(content) !== null
  );
}
