export {
  investigate,
  investigateStream,
  type InvestigationStep,
  type InvestigateOptions,
  type InvestigationResult,
  type TokenUsage,
} from './agent.js';

export {
  getSessionManifest,
  fetchTape,
  getOHLCVData,
  getBookSnapshots,
  computeMicrostructureMetrics,
  emitReport,
  renderChart,
  getAgentThoughts,
  analyzeAgentCorrelation,
  detectPatterns,
} from './tools/index.js';
