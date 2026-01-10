import { tool } from 'ai';
import { z } from 'zod';
import { getOHLCV, fetchTapeEvents } from '@ai-exchange/db';
import type { OHLCVBar } from '@ai-exchange/types';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';

// Cache last renderer config to avoid recreating
let lastRendererConfig: { width: number; height: number } | null = null;
let chartJSNodeCanvas: ChartJSNodeCanvas | null = null;

function getRenderer(width: number, height: number): ChartJSNodeCanvas {
  if (!chartJSNodeCanvas || !lastRendererConfig ||
      lastRendererConfig.width !== width || lastRendererConfig.height !== height) {
    chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#1a1a2e',
    });
    lastRendererConfig = { width, height };
  }
  return chartJSNodeCanvas;
}

interface Annotation {
  timestamp: number;
  label: string;
  color?: string;
}

function buildCandlestickConfig(
  bars: OHLCVBar[],
  annotations?: Annotation[]
): ChartConfiguration {
  // Chart.js doesn't have native candlestick support, so we'll use a combination:
  // - Line chart for close prices (main trend)
  // - Floating bars for high-low range
  // - Scatter points for open/close

  const labels = bars.map((b) => `${(b.intervalStart / 1000).toFixed(1)}s`);
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const opens = bars.map((b) => b.open);

  // Calculate colors based on direction
  const colors = bars.map((b) => (b.close >= b.open ? '#22c55e' : '#ef4444'));

  // Annotation lines for news events etc
  const annotationPluginConfig: Record<string, unknown> = {};
  if (annotations && annotations.length > 0) {
    annotationPluginConfig.annotation = {
      annotations: annotations.map((a, i) => ({
        type: 'line',
        xMin: bars.findIndex((b) => b.intervalStart >= a.timestamp),
        xMax: bars.findIndex((b) => b.intervalStart >= a.timestamp),
        borderColor: a.color || '#fbbf24',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          content: a.label,
          enabled: true,
          position: 'start',
          backgroundColor: a.color || '#fbbf24',
          color: '#000',
          font: { size: 10 },
        },
      })),
    };
  }

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Close',
          data: closes,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'High',
          data: highs,
          borderColor: 'rgba(34, 197, 94, 0.3)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [2, 2],
          fill: false,
        },
        {
          label: 'Low',
          data: lows,
          borderColor: 'rgba(239, 68, 68, 0.3)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [2, 2],
          fill: false,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#d1d5db' },
        },
        title: {
          display: true,
          text: 'Price Chart (OHLC)',
          color: '#d1d5db',
          font: { size: 14 },
        },
        ...annotationPluginConfig,
      },
      scales: {
        x: {
          grid: { color: '#2a2a3e' },
          ticks: { color: '#9ca3af', maxTicksLimit: 15 },
        },
        y: {
          grid: { color: '#2a2a3e' },
          ticks: { color: '#9ca3af' },
        },
      },
    },
  };
}

function buildVolumeConfig(bars: OHLCVBar[]): ChartConfiguration {
  const labels = bars.map((b) => `${(b.intervalStart / 1000).toFixed(1)}s`);
  const volumes = bars.map((b) => b.volume);
  const colors = bars.map((b) => (b.close >= b.open ? '#22c55e' : '#ef4444'));

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Volume',
          data: volumes,
          backgroundColor: colors.map((c) => c + '80'), // Add transparency
          borderColor: colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Volume Profile',
          color: '#d1d5db',
          font: { size: 14 },
        },
      },
      scales: {
        x: {
          grid: { color: '#2a2a3e' },
          ticks: { color: '#9ca3af', maxTicksLimit: 15 },
        },
        y: {
          grid: { color: '#2a2a3e' },
          ticks: { color: '#9ca3af' },
        },
      },
    },
  };
}

function buildLineConfig(
  bars: OHLCVBar[],
  annotations?: Annotation[]
): ChartConfiguration {
  const labels = bars.map((b) => `${(b.intervalStart / 1000).toFixed(1)}s`);
  const closes = bars.map((b) => b.close);

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Price',
          data: closes,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.2)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Price Trend',
          color: '#d1d5db',
          font: { size: 14 },
        },
      },
      scales: {
        x: {
          grid: { color: '#2a2a3e' },
          ticks: { color: '#9ca3af', maxTicksLimit: 15 },
        },
        y: {
          grid: { color: '#2a2a3e' },
          ticks: { color: '#9ca3af' },
        },
      },
    },
  };
}

export const renderChart = tool({
  description:
    'Render a price chart image for visual analysis. Returns base64-encoded PNG that you can analyze visually. Use this to see price patterns, trends, and anomalies that might not be obvious from raw data.',
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
    startTime: z.number().optional().describe('Start timestamp in milliseconds'),
    endTime: z.number().optional().describe('End timestamp in milliseconds'),
    resolution: z
      .number()
      .default(1000)
      .describe('Candle resolution in milliseconds (1000 = 1 second)'),
    chartType: z
      .enum(['candlestick', 'line', 'volume'])
      .default('candlestick')
      .describe('Type of chart to render'),
    width: z.number().default(800).describe('Chart width in pixels'),
    height: z.number().default(400).describe('Chart height in pixels'),
    annotations: z
      .array(
        z.object({
          timestamp: z.number().describe('Timestamp to mark'),
          label: z.string().describe('Label for the annotation'),
          color: z.string().optional().describe('Color (hex) for the annotation'),
        })
      )
      .optional()
      .describe('Annotations to add to the chart (news events, key moments)'),
  }),
  execute: async ({
    sessionId,
    startTime,
    endTime,
    resolution,
    chartType,
    width,
    height,
    annotations,
  }: {
    sessionId: string;
    startTime?: number;
    endTime?: number;
    resolution: number;
    chartType: 'candlestick' | 'line' | 'volume';
    width: number;
    height: number;
    annotations?: Annotation[];
  }): Promise<{
    image: string;
    mimeType: string;
    barCount: number;
    timeRange: { start?: number; end?: number };
    priceRange: { min: number; max: number };
  }> => {
    const bars = getOHLCV(sessionId, resolution, startTime, endTime);

    if (bars.length === 0) {
      return {
        image: '',
        mimeType: 'image/png',
        barCount: 0,
        timeRange: { start: undefined, end: undefined },
        priceRange: { min: 0, max: 0 },
      };
    }

    const renderer = getRenderer(width, height);

    let config: ChartConfiguration;
    switch (chartType) {
      case 'volume':
        config = buildVolumeConfig(bars);
        break;
      case 'line':
        config = buildLineConfig(bars, annotations);
        break;
      case 'candlestick':
      default:
        config = buildCandlestickConfig(bars, annotations);
        break;
    }

    const imageBuffer = await renderer.renderToBuffer(config);
    const base64 = imageBuffer.toString('base64');

    const prices = bars.flatMap((b) => [b.high, b.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return {
      image: base64,
      mimeType: 'image/png',
      barCount: bars.length,
      timeRange: {
        start: bars[0]?.intervalStart,
        end: bars[bars.length - 1]?.intervalStart,
      },
      priceRange: { min: minPrice, max: maxPrice },
    };
  },
});
