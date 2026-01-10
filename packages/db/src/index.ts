export { getDb, closeDb } from './connection.js';

export {
  createSession,
  getSession,
  listSessions,
  updateSessionStatus,
  deleteSession,
} from './sessions.js';

export {
  indexTapeEvent,
  fetchTapeEvents,
  fetchAllTapeEvents,
  getTapeEventCount,
  type TapeFetchOptions,
} from './tape.js';

export { insertOHLCV, getOHLCV } from './ohlcv.js';

export { insertSnapshot, getSnapshots, getSnapshotAt } from './snapshots.js';

export {
  generateInvestigationId,
  saveReport,
  getReport,
  getSessionReports,
  listReports,
  getReportStatuses,
  setInvestigationStatus,
  getInvestigationStatus,
  getRunningInvestigations,
  type InvestigationStatus,
} from './reports.js';
