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
  saveReport,
  getReport,
  listReports,
  getReportStatuses,
  setInvestigationStatus,
  getInvestigationStatus,
  type InvestigationStatus,
} from './reports.js';
