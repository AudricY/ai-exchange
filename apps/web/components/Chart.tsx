'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import type { OHLCVBar } from '@ai-exchange/types';

interface ChartProps {
  data: OHLCVBar[];
  currentTime?: number;
  height?: number;
}

export function Chart({ data, currentTime, height = 400 }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2a2a3e' },
        horzLines: { color: '#2a2a3e' },
      },
      width: containerRef.current.clientWidth,
      height,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const chartData = data.map((bar) => ({
        time: bar.intervalStart / 1000 as unknown as import('lightweight-charts').Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));
      seriesRef.current.setData(chartData);
    }
  }, [data]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">Price Chart</h3>
      <div ref={containerRef} className="w-full" />
      {data.length === 0 && (
        <div className="h-[400px] flex items-center justify-center text-gray-400">
          No chart data available
        </div>
      )}
    </div>
  );
}
