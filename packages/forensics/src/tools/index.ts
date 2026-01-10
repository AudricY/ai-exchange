// Session-scoped tools factory (preferred)
export { createSessionTools, type SessionTools } from './create-tools.js';

// Legacy global tools (require sessionId in each call)
export { getSessionManifest } from './get-session-manifest.js';
export { fetchTape } from './fetch-tape.js';
export { getOHLCVData } from './get-ohlcv.js';
export { getBookSnapshots } from './get-book-snapshots.js';
export { computeMicrostructureMetrics } from './compute-metrics.js';
export { emitReport } from './emit-report.js';
export { renderChart } from './render-chart.js';
export { getAgentThoughts } from './get-agent-thoughts.js';
export { analyzeAgentCorrelation } from './analyze-correlation.js';
export { detectPatterns } from './detect-patterns.js';
