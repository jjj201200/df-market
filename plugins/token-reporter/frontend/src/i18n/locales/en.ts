export const en = {
  common: {
    input: 'Input',
    output: 'Output',
    cacheRead: 'Cache Read',
    cacheCreate: 'Cache Create',
    inputShort: 'In',
    outputShort: 'Out',
    cacheReadShort: 'CR',
    cacheCreateShort: 'CC',
    turns: 'turns',
    turn: 'turn',
    total: 'Total',
    cost: 'Cost',
    loading: 'Loading session data...',
    copy: 'Copy',
    copied: 'Copied',
    collapse: 'Collapse',
    expand: 'Expand',
    expandAll: 'Expand all',
    noOutput: '(no output)',
    close: 'Close',
    estimated: '(estimated)',
  },

  error: {
    failedLoadSessions: 'Failed to load sessions',
    failedLoadSession: 'Failed to load session',
    noSessions: 'No sessions available',
    noData: 'No data for this session',
    noSessionData: 'No session data loaded. Select a session to analyze.',
  },

  nav: {
    overview: 'Overview',
    cache: 'Cache',
    tools: 'Tools',
    context: 'Context',
    subagents: 'Subagents',
    timing: 'Timing',
    mcp: 'MCP',
    prompt: 'Prompt',
    files: 'Files',
    analytics: 'Analytics',
    sessionAnalytics: 'Session Analytics',
    splitView: 'Split View',
    exitSplitView: 'Exit Split View',
  },

  chart: {
    tokenUsage: 'Token Usage',
    requestRange: 'Request #{first} \u2013 #{last}',
  },

  session: {
    copyId: 'Copy ID',
    copySessionId: 'Copy session ID',
    copiedId: 'Copied!',
    totalsTitle: 'Session Totals',
    assistantMessages: 'Assistant messages',
    totalTokens: 'Total tokens',
    toolUses: 'Tool uses',
    hookCalls: 'Hook calls',
    subagents: 'Subagents',
    errors: 'Errors',
    stopReasons: 'Stop reasons',
    collapseTotals: 'Collapse totals',
    expandTotals: 'Expand totals',
    globalLabel: 'Session Totals',
  },

  limits: {
    title: 'Limits',
    session: 'Session',
    fiveHour: '5h',
    sevenDay: '7d',
    reset: 'reset {time}',
  },

  dim: {
    toggleShow: 'TOGGLE SHOW',
  },

  overview: {
    totalCost: 'Total Cost',
    totalTokens: 'Total Tokens',
    avgPerTurn: 'Avg / Turn',
    mostExpensiveTurn: 'Most Expensive Turn',
    thinkingTurns: 'Thinking Turns',
    estThinkingCost: 'Est. Thinking Cost',
    tokensEstimate: '~{tokens} tokens',
    nTurns: '{count} turns',
    costByTokenType: 'Cost by Token Type',
    toolCallsByCategory: 'Tool Calls by Category',
    costByModel: 'Cost by Model',
    modelDetails: 'Model Details',
    model: 'Model',
    turns: 'Turns',
    tokens: 'Tokens',
    cost: 'Cost',
    costPerTurn: '$/Turn',
    modelSwitches: 'Model switches: {count}',
    recommendations: 'Recommendations',
    stopReasons: 'Stop Reasons',
    stopReasonsSub: 'assistant stop reason distribution',
    cacheTtl: 'Cache TTL',
    cacheTtlSub: 'ephemeral cache creation breakdown',
    keyInsights: 'Key Insights',
    dominantModel: 'Dominant Model',
    subagentCost: 'Subagent Cost',
    sidechainCost: 'Sidechain Cost',
    thinkingCost: 'Thinking Cost',
    mcpCalls: 'MCP Calls',
    sessionDuration: 'Session Duration',
    costPerMinute: 'Cost / Minute',
    peakContext: 'Peak Context',
    atTurn: 'at Turn',
    fileActivity: 'File Activity',
    readEdit: '{read} read / {edit} edited',
  },

  cache: {
    hitRate: 'Cache Hit Rate',
    efficiencyRatio: 'Efficiency Ratio',
    readsPerCreation: 'cache reads per creation',
    estimatedSavings: 'Estimated Savings',
    readTokens: 'Cache Read Tokens',
    createTokens: 'Cache Create Tokens',
    target: 'Target: 60-80%',
    hitRatePerTurn: 'Cache Hit Rate per Turn',
    compact: 'compact',
  },

  tools: {
    totalCalls: 'Total Tool Calls',
    errorRate: 'Error Rate',
    nFailed: '{count} failed',
    redundantGroups: 'Redundant Groups',
    largeReturns: 'Large Returns (>50KB)',
    callsAndErrors: 'Tool Calls & Errors by Category',
    total: 'Total',
    errors: 'Errors',
    redundantCalls: 'Redundant Tool Calls',
    timesCount: 'x{count}',
    turnsLabel: 'turns: {ids}',
    largeToolReturns: 'Large Tool Returns (>50KB)',
    turnNumber: 'Turn #{id}',
    sidechainCalls: 'Sidechain Calls',
    sidechainTurns: 'Sidechain Turns',
    pctOfTotal: '{pct}% of total',
    sidechainCost: 'Sidechain Cost',
  },

  toolStats: {
    total: 'Total',
    ok: 'OK',
    err: 'Err',
    duration: 'Duration',
    slowest: 'Slowest',
    totalRet: 'Total ret.',
    largest: 'Largest',
  },

  context: {
    cumulativeTokens: 'Cumulative Tokens',
    avgGrowth: 'Avg Growth / Turn',
    compactionEvents: 'Compaction Events',
    contextWindowGrowth: 'Context Window Growth',
    cumulative: 'Cumulative',
    compactWithTokens: 'compact ({tokens})',
    tokensAddedPerTurn: 'Tokens Added per Turn',
    delta: 'Delta',
    thinkingEst: 'Thinking (est.)',
  },

  subagents: {
    mainSessionCost: 'Main Session Cost',
    nTurns: '{count} turns',
    totalSubagentCost: 'Total Subagent Cost',
    nAgents: '{count} agents',
    subagentCostPct: 'Subagent Cost %',
    noSubagents: 'No subagents in this session.',
    agent: 'Agent',
    type: 'Type',
    turns: 'Turns',
    input: 'Input',
    output: 'Output',
    cacheR: 'Cache R',
    cacheC: 'Cache C',
    cost: 'Cost',
    tokPerTurn: 'Tok/Turn',
    mainSession: 'Main Session',
    na: '-',
  },

  timing: {
    sessionDuration: 'Session Duration',
    costPerMinute: 'Cost / Minute',
    idleTime: 'Idle Time',
    avgTurnInterval: 'Avg Turn Interval',
    totalToolTime: 'Total Tool Time',
    turnIntervals: 'Turn Intervals (seconds)',
    idleThreshold: 'idle threshold ({seconds}s)',
    interval: 'Interval',
    avgToolDuration: 'Avg Tool Duration by Category',
    avgDuration: 'Avg Duration',
    totalToolDuration: 'Total Tool Duration by Category',
    totalDuration: 'Total Duration',
    slowestToolCalls: 'Slowest Tool Calls',
    tool: 'Tool',
    turn: 'Turn',
    duration: 'Duration',
    hookPerformance: 'Hook Performance',
    totalHookTime: 'Total Hook Time',
    hookCalls: 'Hook Calls',
    hook: 'Hook',
    count: 'Count',
    errors: 'Errors',
  },

  mcp: {
    totalCalls: 'MCP Calls',
    mcpPct: 'MCP %',
    errorRate: 'MCP Error Rate',
    avgDuration: 'Avg MCP Duration',
    callsByServer: 'Calls by Server',
    serverPerformance: 'Server Performance',
    server: 'Server',
    calls: 'Calls',
    errors: 'Errors',
    avgMs: 'Avg ms',
    totalMs: 'Total ms',
    noMcp: 'No MCP tool calls in this session.',
    methodPerformance: 'Method Performance',
    method: 'Method',
    turnsWithMcp: 'Turns with MCP',
    turnNumber: 'Turn #{id}',
    mcpCallsInTurn: '{count} MCP call(s)',
  },

  prompt: {
    title: 'Prompt Efficiency',
    avgLength: 'Avg Input Length',
    avgTokens: 'Avg Input Tokens',
    ioRatio: 'Input / Output Ratio',
    shortStreak: 'Short Input Streak',
    longestInput: 'Longest Input',
    trend: 'Input Trend',
    turn: 'Turn',
    chars: 'Chars',
    tokens: 'Tokens',
    ratio: 'Ratio',
  },

  pressure: {
    title: 'Context Pressure',
    peakTokens: 'Peak Tokens',
    peakTurn: 'Peak Turn',
    compactionCount: 'Compactions',
    avgTurnsBetweenCompact: 'Avg Turns Between Compactions',
    highSpikeTurns: 'High Spike Turns',
    growthRate: 'Growth / 10 Turns',
    estimatedToLimit: 'Est. Turns to Limit',
    turn: 'Turn',
    delta: 'Delta',
    trend: 'Context Growth Trend',
  },

  files: {
    title: 'File Operations',
    topReads: 'Top Read Files',
    readEditRatio: 'Read / Edit Ratio',
    totalReadFiles: 'Read Files',
    totalEditFiles: 'Edited Files',
    totalReadOps: 'Read Ops',
    totalEditOps: 'Edit Ops',
    bloatedGreps: 'Bloated Greps',
    unreadReads: 'Read but Not Edited',
    filePath: 'File',
    readCount: 'Reads',
    hasOffset: 'Offset/Limit',
    pattern: 'Pattern',
    glob: 'Glob',
    retLines: 'Lines',
    turn: 'Turn',
  },

  compact: {
    label: 'COMPACT',
    description: 'Context window compressed',
    detail: '{time} \u00b7 {trigger} \u00b7 {tokens} tokens before',
  },

  conversation: {
    assistant: 'ASSISTANT',
    sidechain: 'SIDECHAIN',
    user: 'USER',
    internalReasoning: 'Internal reasoning',
    tokensEst: '{count} tokens (est.)',
    toolCall: 'tool call',
    toolCalls: 'tool calls',
    nErr: '{count} ERR',
    expandParams: 'Expand params & output',
    inputLabel: 'INPUT',
    outputLabel: 'OUTPUT',
    commandOutput: 'output',
    viewTurns: 'View {count} turns',
  },

  composition: {
    title: 'Context Composition',
    live: 'live',
    estimated: 'estimated',
    hookStale: 'hook stale',
    enableAuditHint: 'Enable audit for exact data: `token-reporter-audit on`',
    hookStaleHint: 'Hook has not captured in 5+ minutes. Restart Claude Code or run `token-reporter-audit status`.',
    unknownPlaceholder: '— (enable audit)',
    deltaLabel: 'Δ {delta}',
    pctLabel: '{pct}%',
    sources: {
      systemPrompt: 'System prompt',
      toolsSchema: 'Tools schema',
      user: 'User messages',
      assistant: 'Assistant messages',
      toolUse: 'Tool use',
      toolResult: 'Tool result',
      thinking: 'Thinking',
    },
  },

  audit: {
    banner: {
      title: 'Context composition is estimated.',
      cta: 'Run `token-reporter-audit on` for real data.',
      dismiss: 'Dismiss',
      hookStaleTitle: 'Audit hook appears inactive.',
      hookStaleCta: 'Restart Claude Code, or run `token-reporter-audit status` to inspect.',
      showAgain: 'Show audit status',
      enabledTitle: 'Context audit is enabled.',
      enabledCta: 'Live composition from captured API bodies. Run `token-reporter-audit off` to disable.',
    },
    privacy: {
      warning: 'Enabling audit stores full API request/response bodies (system prompt, tools, your prompts, assistant output, thinking) under ~/.claude/token-reporter/captures/ in plaintext. Nothing is uploaded.',
      purgeHint: 'Run `token-reporter-audit purge` to clear all captures.',
    },
  },

  rec: {
    potentialSavings: 'Potential savings: {amount}',
    lowCache: {
      title: 'Low cache hit rate ({rate})',
      detail:
        'Cache hit rate below 30%. Structure prompts to preserve prefix stability. Avoid changing system prompts between turns. Static content should come first, dynamic content last.',
      savings: 'Up to {amount} if hit rate improves to 50%',
    },
    toolErrors: {
      title: '{errors} of {total} tool calls failed ({rate})',
      detail: 'Failed tool calls waste tokens on both the request and the error response. Check common error patterns.',
    },
    redundantTools: {
      title: '{count} redundant tool calls detected',
      detail: '{groups} tool call pattern(s) repeated with identical results. Top: {top}.',
    },
    frequentCompact: {
      title: 'Context compacted {count} times (avg every {avgTurns} turns)',
      detail:
        'Sessions hitting context limits quickly. Consider more targeted file reads (use offset/limit), more specific grep patterns, and delegating verbose tasks to subagents.',
    },
    highOutput: {
      title: 'Output tokens account for {pct} of cost',
      detail:
        'Output tokens are 5x more expensive than input. Consider asking for concise responses or reducing verbose explanations.',
    },
    largeReturns: {
      title: '{count} tool calls returned >50KB',
      detail:
        'Large tool returns inflate context. Use offset/limit for Read, more specific grep patterns, or pipe through head/tail for bash. Largest: {toolName} ({retSize}).',
    },
    subagentCost: {
      title: 'Subagents consumed {pct} of total cost',
      detail: 'Verify that subagent delegations are worthwhile. Consider using Haiku model for exploration subagents.',
      savings: '{amount} if subagents used Haiku',
    },
    goodCache: {
      title: 'Good cache hit rate ({rate})',
      detail: 'Cache is working well. Saved approximately {amount} this session.',
    },
    highIdle: {
      title: '{pct} of session time was idle',
      detail:
        'More time was spent idle than active. Consider batching requests or planning prompts before starting a session.',
    },
    slowTool: {
      title: '{cls} tools average {time}s per call',
      detail:
        '{count} {cls} calls averaged over 5s. Long-running commands inflate session time. Consider running them outside Claude Code.',
    },
    highThinking: {
      title: 'Extended thinking ~{pct} of output cost',
      detail:
        'Thinking tokens (~{tokens}K est.) are charged at output rates. For straightforward tasks, consider shorter prompts or models without extended thinking.',
    },
    opusSimple: {
      title: 'Opus used for {turns} turns with short outputs',
      detail:
        'Average output is only {tokens} tokens/turn on Opus. These may be simple tasks better suited for Sonnet (5x cheaper).',
    },
    highSidechain: {
      title: 'Sidechain operations: {pct} of total cost',
      detail: '{turns} sidechain turns consumed {amount}. Review whether all sidechain tool executions are necessary.',
    },
    highMcp: {
      title: 'MCP tools account for {pct} of all calls',
      detail:
        '{count} MCP calls detected. For simple queries, consider using CLI tools instead to reduce context overhead.',
    },
    mcpErrors: {
      title: 'MCP server "{server}" has {rate} error rate',
      detail: 'Server "{server}" failed on {count} calls. Check configuration or consider disabling it.',
    },
    slowMcp: {
      title: 'MCP server "{server}" averages {time}s per call',
      detail: 'Server "{server}" is slow ({count} calls). Consider caching results or using a faster alternative.',
    },
    fragmentedPrompts: {
      title: '{count} consecutive very short user inputs detected',
      detail:
        'Multiple short inputs in a row suggest fragmented prompting. Consider merging them into a single, complete request.',
    },
    bloatedPrompt: {
      title: 'One prompt is very long ({chars} chars)',
      detail:
        'The longest user input generated relatively little output. Consider trimming unnecessary context from that turn.',
    },
    vaguePrompt: {
      title: 'Input/output ratio is only {ratio}',
      detail:
        '{count} turn(s) produced >5K output tokens from small inputs. More specific prompts may reduce verbose responses.',
    },
    highPressure: {
      title: 'Context compacted {count} times (avg every {avg} turns)',
      detail:
        'Sessions hitting context limits quickly. Consider more targeted file reads, more specific grep patterns, and delegating verbose tasks to subagents.',
    },
    contextSpike: {
      title: '{count} turn(s) added >20K tokens at once',
      detail: 'Turn #{turnId} added {delta} tokens. Check for large file reads or very long outputs in that turn.',
    },
    repeatedReads: {
      title: '"{file}" read {count} times without offset/limit',
      detail:
        'Repeated full-file reads inflate context. Consider caching content or using offset/limit for targeted reads.',
    },
    bloatedGrep: {
      title: '{count} grep calls returned >100 lines',
      detail: 'Broad grep pattern: "{pattern}". Consider a more specific pattern or add a glob filter.',
    },
    lowEditCoverage: {
      title: 'Read/edit ratio is {ratio}',
      detail: 'Many files were read but never edited. Try to specify target files more precisely upfront.',
    },
  },
} as const;

/** Recursively map all leaf values to string (drop literal types). */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type Translation = DeepString<typeof en>;
