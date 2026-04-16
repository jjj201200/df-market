export function toolNameToCls(name) {
    const n = (name || '').toLowerCase();
    if (n === 'bash')
        return 'bash';
    if (n === 'read')
        return 'read';
    if (n === 'edit')
        return 'edit';
    if (n === 'write')
        return 'write';
    if (n === 'toolsearch')
        return 'toolsearch';
    if (n === 'grep')
        return 'grep';
    if (n === 'glob')
        return 'glob';
    if (n === 'web' || n === 'web_search' || n === 'web_fetch')
        return 'web';
    if (n === 'agent')
        return 'agent';
    if (n.startsWith('mcp__'))
        return 'mcp';
    if (n === 'exitplanmode' ||
        n === 'enterplanmode' ||
        n === 'remember' ||
        n === 'clear' ||
        n === 'compact') {
        return 'cccmd';
    }
    return 'other';
}
export function parseMcpToolName(name) {
    if (!name || !name.startsWith('mcp__'))
        return null;
    const parts = name.split('__');
    if (parts.length < 3)
        return null;
    const server = parts[1];
    const method = parts.slice(2).join('__');
    return { server, method };
}
export function buildInputArgs(toolName, input) {
    const entries = [];
    for (const [k, v] of Object.entries(input)) {
        let vc = 'str';
        if (k === 'command')
            vc = 'cmd';
        else if (k === 'file_path' || k === 'uri' || k === 'path')
            vc = 'path';
        else if (typeof v === 'number')
            vc = 'num';
        else if (typeof v === 'boolean')
            vc = 'bool';
        const display = typeof v === 'string' ? v : JSON.stringify(v);
        entries.push({
            k,
            v: display.length > 300 ? display.slice(0, 300) + '...' : display,
            vc,
        });
    }
    return entries;
}
export function buildParamsSummary(toolName, input) {
    const n = (toolName || '').toLowerCase();
    if (n === 'bash')
        return typeof input.command === 'string' ? input.command : '';
    if (n === 'read') {
        let s = typeof input.file_path === 'string' ? input.file_path : '';
        if (input.offset || input.limit) {
            const offset = typeof input.offset === 'number' ? input.offset : 1;
            const limit = typeof input.limit === 'number' ? input.limit : 2000;
            s += ` · L${offset}-${offset + limit - 1}`;
        }
        return s;
    }
    if (n === 'edit' || n === 'write')
        return typeof input.file_path === 'string' ? input.file_path : '';
    if (n === 'grep') {
        const pattern = typeof input.pattern === 'string' ? input.pattern : '';
        const glob = typeof input.glob === 'string' ? input.glob : '';
        return `pattern: "${pattern}"${glob ? ' · ' + glob : ''}`;
    }
    if (n === 'glob')
        return typeof input.pattern === 'string' ? input.pattern : '';
    const first = Object.values(input).find((v) => typeof v === 'string');
    return first || JSON.stringify(input).slice(0, 80);
}
