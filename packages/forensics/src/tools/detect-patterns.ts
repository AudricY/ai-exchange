import { tool } from 'ai';
import { z } from 'zod';
import { getOHLCV, fetchTapeEvents } from '@ai-exchange/db';
import type { OHLCVBar } from '@ai-exchange/types';

type PatternType =
  | 'momentum_shift'
  | 'volume_spike'
  | 'price_gap'
  | 'consolidation'
  | 'breakout'
  | 'exhaustion'
  | 'accumulation'
  | 'distribution';

type Sensitivity = 'low' | 'medium' | 'high';

interface DetectedPattern {
  type: PatternType;
  timestamp: number;
  description: string;
  confidence: number;
  priceAtDetection: number;
  suggestedInvestigation: string;
  metrics?: Record<string, number | string>;
}

const SENSITIVITY_THRESHOLDS: Record<Sensitivity, Record<string, number>> = {
  low: {
    volumeSpikeMultiplier: 3.0,
    priceGapPercent: 0.5,
    consolidationRange: 0.2,
    momentumShiftStrength: 0.8,
  },
  medium: {
    volumeSpikeMultiplier: 2.0,
    priceGapPercent: 0.3,
    consolidationRange: 0.3,
    momentumShiftStrength: 0.5,
  },
  high: {
    volumeSpikeMultiplier: 1.5,
    priceGapPercent: 0.2,
    consolidationRange: 0.4,
    momentumShiftStrength: 0.3,
  },
};

function calculateReturns(bars: OHLCVBar[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const ret = (bars[i].close - bars[i - 1].close) / bars[i - 1].close;
    returns.push(ret);
  }
  return returns;
}

function calculateMovingAverage(values: number[], window: number): number[] {
  const ma: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      ma.push(NaN);
    } else {
      const slice = values.slice(i - window + 1, i + 1);
      ma.push(slice.reduce((a, b) => a + b, 0) / window);
    }
  }
  return ma;
}

function detectMomentumShifts(
  bars: OHLCVBar[],
  sensitivity: Sensitivity
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];
  const returns = calculateReturns(bars);

  if (returns.length < 5) return patterns;

  // Use short and long moving averages to detect trend changes
  const shortMA = calculateMovingAverage(returns, 3);
  const longMA = calculateMovingAverage(returns, 7);

  for (let i = 7; i < returns.length; i++) {
    const prevShort = shortMA[i - 1];
    const currShort = shortMA[i];
    const prevLong = longMA[i - 1];
    const currLong = longMA[i];

    if (isNaN(prevShort) || isNaN(currShort) || isNaN(prevLong) || isNaN(currLong)) continue;

    // Bullish crossover
    if (prevShort <= prevLong && currShort > currLong) {
      const strength = Math.abs(currShort - currLong);
      if (strength > thresholds.momentumShiftStrength * 0.01) {
        patterns.push({
          type: 'momentum_shift',
          timestamp: bars[i + 1].intervalStart,
          description: 'Bullish momentum shift detected (short MA crossed above long MA)',
          confidence: Math.min(0.95, 0.5 + strength * 10),
          priceAtDetection: bars[i + 1].close,
          suggestedInvestigation: `Check for news events or large orders around T=${bars[i + 1].intervalStart}`,
          metrics: { shortMA: currShort, longMA: currLong, strength },
        });
      }
    }

    // Bearish crossover
    if (prevShort >= prevLong && currShort < currLong) {
      const strength = Math.abs(currShort - currLong);
      if (strength > thresholds.momentumShiftStrength * 0.01) {
        patterns.push({
          type: 'momentum_shift',
          timestamp: bars[i + 1].intervalStart,
          description: 'Bearish momentum shift detected (short MA crossed below long MA)',
          confidence: Math.min(0.95, 0.5 + strength * 10),
          priceAtDetection: bars[i + 1].close,
          suggestedInvestigation: `Check for negative news or selling pressure around T=${bars[i + 1].intervalStart}`,
          metrics: { shortMA: currShort, longMA: currLong, strength },
        });
      }
    }
  }

  return patterns;
}

function detectVolumeSpikes(
  bars: OHLCVBar[],
  sensitivity: Sensitivity
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];

  if (bars.length < 10) return patterns;

  const volumes = bars.map((b) => b.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const volumeMultiple = bar.volume / (avgVolume || 1);

    if (volumeMultiple >= thresholds.volumeSpikeMultiplier) {
      const direction = bar.close >= bar.open ? 'buying' : 'selling';
      patterns.push({
        type: 'volume_spike',
        timestamp: bar.intervalStart,
        description: `Volume spike detected: ${volumeMultiple.toFixed(1)}x average volume with ${direction} pressure`,
        confidence: Math.min(0.95, 0.5 + (volumeMultiple - 1) * 0.1),
        priceAtDetection: bar.close,
        suggestedInvestigation: `Investigate who was trading at T=${bar.intervalStart} and why`,
        metrics: { volume: bar.volume, avgVolume, multiple: volumeMultiple },
      });
    }
  }

  return patterns;
}

function detectPriceGaps(
  bars: OHLCVBar[],
  sensitivity: Sensitivity
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];

  for (let i = 1; i < bars.length; i++) {
    const prevBar = bars[i - 1];
    const currBar = bars[i];

    // Gap up: current open > previous high
    if (currBar.open > prevBar.high) {
      const gapPercent = ((currBar.open - prevBar.high) / prevBar.high) * 100;
      if (gapPercent >= thresholds.priceGapPercent) {
        patterns.push({
          type: 'price_gap',
          timestamp: currBar.intervalStart,
          description: `Gap up detected: ${gapPercent.toFixed(2)}% gap from ${prevBar.high} to ${currBar.open}`,
          confidence: Math.min(0.95, 0.6 + gapPercent * 0.1),
          priceAtDetection: currBar.open,
          suggestedInvestigation: `Check for news or large market orders just before T=${currBar.intervalStart}`,
          metrics: { gapPercent, prevHigh: prevBar.high, currOpen: currBar.open },
        });
      }
    }

    // Gap down: current open < previous low
    if (currBar.open < prevBar.low) {
      const gapPercent = ((prevBar.low - currBar.open) / prevBar.low) * 100;
      if (gapPercent >= thresholds.priceGapPercent) {
        patterns.push({
          type: 'price_gap',
          timestamp: currBar.intervalStart,
          description: `Gap down detected: ${gapPercent.toFixed(2)}% gap from ${prevBar.low} to ${currBar.open}`,
          confidence: Math.min(0.95, 0.6 + gapPercent * 0.1),
          priceAtDetection: currBar.open,
          suggestedInvestigation: `Check for negative news or large sell orders just before T=${currBar.intervalStart}`,
          metrics: { gapPercent, prevLow: prevBar.low, currOpen: currBar.open },
        });
      }
    }
  }

  return patterns;
}

function detectConsolidation(
  bars: OHLCVBar[],
  sensitivity: Sensitivity
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];
  const windowSize = 5;

  if (bars.length < windowSize * 2) return patterns;

  for (let i = windowSize; i <= bars.length - windowSize; i++) {
    const window = bars.slice(i - windowSize, i + windowSize);
    const highs = window.map((b) => b.high);
    const lows = window.map((b) => b.low);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const rangePercent = ((maxHigh - minLow) / minLow) * 100;

    if (rangePercent <= thresholds.consolidationRange) {
      // Check if this is start of consolidation (not already in one)
      const isNewConsolidation =
        patterns.length === 0 ||
        patterns[patterns.length - 1].timestamp < bars[i - windowSize].intervalStart;

      if (isNewConsolidation) {
        patterns.push({
          type: 'consolidation',
          timestamp: bars[i].intervalStart,
          description: `Consolidation zone detected: price ranging ${rangePercent.toFixed(2)}% over ${windowSize * 2} bars`,
          confidence: 0.7,
          priceAtDetection: bars[i].close,
          suggestedInvestigation: `Watch for breakout from range [${minLow.toFixed(2)} - ${maxHigh.toFixed(2)}]`,
          metrics: { rangePercent, support: minLow, resistance: maxHigh },
        });
      }
    }
  }

  return patterns;
}

function detectBreakouts(
  bars: OHLCVBar[],
  sensitivity: Sensitivity
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const lookback = 10;

  if (bars.length < lookback + 1) return patterns;

  for (let i = lookback; i < bars.length; i++) {
    const prevBars = bars.slice(i - lookback, i);
    const currBar = bars[i];

    const prevHigh = Math.max(...prevBars.map((b) => b.high));
    const prevLow = Math.min(...prevBars.map((b) => b.low));

    // Breakout above resistance
    if (currBar.close > prevHigh && currBar.volume > 0) {
      const breakoutStrength = ((currBar.close - prevHigh) / prevHigh) * 100;
      patterns.push({
        type: 'breakout',
        timestamp: currBar.intervalStart,
        description: `Bullish breakout: price broke above ${lookback}-bar high of ${prevHigh.toFixed(2)}`,
        confidence: Math.min(0.9, 0.5 + breakoutStrength * 0.2),
        priceAtDetection: currBar.close,
        suggestedInvestigation: `Check volume and order flow at T=${currBar.intervalStart} for breakout validity`,
        metrics: { breakoutStrength, resistance: prevHigh, breakoutPrice: currBar.close },
      });
    }

    // Breakdown below support
    if (currBar.close < prevLow && currBar.volume > 0) {
      const breakoutStrength = ((prevLow - currBar.close) / prevLow) * 100;
      patterns.push({
        type: 'breakout',
        timestamp: currBar.intervalStart,
        description: `Bearish breakdown: price broke below ${lookback}-bar low of ${prevLow.toFixed(2)}`,
        confidence: Math.min(0.9, 0.5 + breakoutStrength * 0.2),
        priceAtDetection: currBar.close,
        suggestedInvestigation: `Check for panic selling or news at T=${currBar.intervalStart}`,
        metrics: { breakoutStrength, support: prevLow, breakdownPrice: currBar.close },
      });
    }
  }

  return patterns;
}

function detectExhaustion(
  bars: OHLCVBar[],
  sensitivity: Sensitivity
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const windowSize = 5;

  if (bars.length < windowSize) return patterns;

  for (let i = windowSize; i < bars.length; i++) {
    const window = bars.slice(i - windowSize, i + 1);
    const closes = window.map((b) => b.close);
    const volumes = window.map((b) => b.volume);

    // Check for uptrend with declining volume (exhaustion)
    const priceUp = closes[closes.length - 1] > closes[0];
    const volumeDecline =
      volumes.slice(-3).every((v, idx, arr) => idx === 0 || v <= arr[idx - 1]);

    if (priceUp && volumeDecline) {
      const priceChange = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
      if (priceChange > 0.5) {
        patterns.push({
          type: 'exhaustion',
          timestamp: bars[i].intervalStart,
          description: `Potential exhaustion: price up ${priceChange.toFixed(2)}% but volume declining`,
          confidence: 0.6,
          priceAtDetection: bars[i].close,
          suggestedInvestigation: `Watch for reversal around T=${bars[i].intervalStart}`,
          metrics: { priceChange, volumeTrend: 'declining' },
        });
      }
    }

    // Check for downtrend with declining volume
    const priceDown = closes[closes.length - 1] < closes[0];
    if (priceDown && volumeDecline) {
      const priceChange = ((closes[0] - closes[closes.length - 1]) / closes[0]) * 100;
      if (priceChange > 0.5) {
        patterns.push({
          type: 'exhaustion',
          timestamp: bars[i].intervalStart,
          description: `Potential selling exhaustion: price down ${priceChange.toFixed(2)}% but volume declining`,
          confidence: 0.6,
          priceAtDetection: bars[i].close,
          suggestedInvestigation: `Watch for bounce around T=${bars[i].intervalStart}`,
          metrics: { priceChange, volumeTrend: 'declining' },
        });
      }
    }
  }

  return patterns;
}

function detectAccumulationDistribution(
  bars: OHLCVBar[],
  sensitivity: Sensitivity
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  if (bars.length < 5) return patterns;

  // Find local support and resistance levels
  const prices = bars.map((b) => b.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice;

  const supportZone = minPrice + range * 0.2;
  const resistanceZone = maxPrice - range * 0.2;

  // Look for high volume at support (accumulation) or resistance (distribution)
  const avgVolume = bars.reduce((sum, b) => sum + b.volume, 0) / bars.length;

  for (const bar of bars) {
    if (bar.volume > avgVolume * 1.5) {
      if (bar.close <= supportZone && bar.close >= bar.open) {
        patterns.push({
          type: 'accumulation',
          timestamp: bar.intervalStart,
          description: `Potential accumulation: high volume buying at support zone (${supportZone.toFixed(2)})`,
          confidence: 0.65,
          priceAtDetection: bar.close,
          suggestedInvestigation: `Check who is buying at T=${bar.intervalStart}`,
          metrics: { supportZone, volume: bar.volume, avgVolume },
        });
      }

      if (bar.close >= resistanceZone && bar.close <= bar.open) {
        patterns.push({
          type: 'distribution',
          timestamp: bar.intervalStart,
          description: `Potential distribution: high volume selling at resistance zone (${resistanceZone.toFixed(2)})`,
          confidence: 0.65,
          priceAtDetection: bar.close,
          suggestedInvestigation: `Check who is selling at T=${bar.intervalStart}`,
          metrics: { resistanceZone, volume: bar.volume, avgVolume },
        });
      }
    }
  }

  return patterns;
}

export const detectPatterns = tool({
  description:
    'Run pre-computed pattern detection algorithms on price and volume data. Identifies technical patterns like momentum shifts, volume spikes, gaps, consolidation, breakouts, and accumulation/distribution zones.',
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
    patterns: z
      .array(
        z.enum([
          'momentum_shift',
          'volume_spike',
          'price_gap',
          'consolidation',
          'breakout',
          'exhaustion',
          'accumulation',
          'distribution',
        ])
      )
      .optional()
      .describe('Specific patterns to detect (default: all)'),
    sensitivity: z
      .enum(['low', 'medium', 'high'])
      .default('medium')
      .describe('Detection sensitivity (higher = more patterns detected)'),
    startTime: z.number().optional().describe('Start timestamp'),
    endTime: z.number().optional().describe('End timestamp'),
  }),
  execute: async ({
    sessionId,
    patterns: patternTypes,
    sensitivity,
    startTime,
    endTime,
  }: {
    sessionId: string;
    patterns?: PatternType[];
    sensitivity: Sensitivity;
    startTime?: number;
    endTime?: number;
  }): Promise<{
    patterns: DetectedPattern[];
    count: number;
    summary: Record<PatternType, number>;
  }> => {
    const bars = getOHLCV(sessionId, 1000, startTime, endTime);

    if (bars.length === 0) {
      return {
        patterns: [],
        count: 0,
        summary: {} as Record<PatternType, number>,
      };
    }

    const detected: DetectedPattern[] = [];
    const allPatterns: PatternType[] = patternTypes || [
      'momentum_shift',
      'volume_spike',
      'price_gap',
      'consolidation',
      'breakout',
      'exhaustion',
      'accumulation',
      'distribution',
    ];

    // Run each detector
    if (allPatterns.includes('momentum_shift')) {
      detected.push(...detectMomentumShifts(bars, sensitivity));
    }
    if (allPatterns.includes('volume_spike')) {
      detected.push(...detectVolumeSpikes(bars, sensitivity));
    }
    if (allPatterns.includes('price_gap')) {
      detected.push(...detectPriceGaps(bars, sensitivity));
    }
    if (allPatterns.includes('consolidation')) {
      detected.push(...detectConsolidation(bars, sensitivity));
    }
    if (allPatterns.includes('breakout')) {
      detected.push(...detectBreakouts(bars, sensitivity));
    }
    if (allPatterns.includes('exhaustion')) {
      detected.push(...detectExhaustion(bars, sensitivity));
    }
    if (allPatterns.includes('accumulation') || allPatterns.includes('distribution')) {
      detected.push(...detectAccumulationDistribution(bars, sensitivity));
    }

    // Sort by timestamp
    detected.sort((a, b) => a.timestamp - b.timestamp);

    // Count by type
    const summary = {} as Record<PatternType, number>;
    for (const pattern of detected) {
      summary[pattern.type] = (summary[pattern.type] || 0) + 1;
    }

    return {
      patterns: detected,
      count: detected.length,
      summary,
    };
  },
});
