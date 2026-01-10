export interface OHLCVBar {
  sessionId: string;
  intervalStart: number;
  resolution: number; // in ms (1000 = 1s, 60000 = 1m)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
}
