#!/usr/bin/env tsx
/**
 * CLI script to show session details
 * Usage: pnpm session <sessionId> [--events 10] [--trades]
 */

import { getSession, fetchTapeEvents, getOHLCV, getReport, closeDb } from '@ai-exchange/db';
import type { TapeEvent, TradeEvent } from '@ai-exchange/types';

function parseArgs(): { sessionId: string; showEvents: number; tradesOnly: boolean } {
  const args = process.argv.slice(2);
  let sessionId = '';
  let showEvents = 5;
  let tradesOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--events' && args[i + 1]) {
      showEvents = parseInt(args[++i], 10);
    } else if (args[i] === '--trades') {
      tradesOnly = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: pnpm session <sessionId> [options]

Arguments:
  sessionId          The session ID to show

Options:
  --events <n>       Number of events to show (default: 5)
  --trades           Only show trade events
  --help, -h         Show this help message

Example:
  pnpm session session-1234567890-abc123def --events 10
  pnpm session session-1234567890-abc123def --trades
`);
      process.exit(0);
    } else if (!args[i].startsWith('-')) {
      sessionId = args[i];
    }
  }

  if (!sessionId) {
    console.error('Error: Session ID is required');
    console.error('Usage: pnpm session <sessionId>');
    process.exit(1);
  }

  return { sessionId, showEvents, tradesOnly };
}

async function main() {
  const { sessionId, showEvents, tradesOnly } = parseArgs();

  try {
    const session = getSession(sessionId);
    if (!session) {
      console.error(`Error: Session not found: ${sessionId}`);
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('Session Details');
    console.log('='.repeat(60));
    console.log(`ID: ${session.id}`);
    console.log(`Name: ${session.name}`);
    console.log(`Status: ${session.status}`);
    console.log(`Created: ${session.createdAt}`);
    if (session.completedAt) {
      console.log(`Completed: ${session.completedAt}`);
    }
    console.log(`Events: ${session.eventCount}`);
    console.log(`Trades: ${session.tradeCount}`);
    if (session.finalPrice) {
      console.log(`Final Price: ${session.finalPrice}`);
    }
    console.log('');

    // Config summary
    console.log('CONFIGURATION');
    console.log('-'.repeat(60));
    console.log(`Duration: ${session.config.durationMs}ms`);
    console.log(`Seed: ${session.config.seed}`);
    console.log(`Initial Price: ${session.config.initialPrice}`);
    console.log(`Agents: ${session.config.agents.length}`);
    for (const agent of session.config.agents) {
      console.log(`  - ${agent.name} (${agent.archetype})`);
    }
    console.log(`News Events: ${session.config.newsSchedule.length}`);
    console.log('');

    // Sample events
    if (showEvents > 0) {
      console.log(`SAMPLE EVENTS (${tradesOnly ? 'trades only' : 'first ' + showEvents})`);
      console.log('-'.repeat(60));

      const eventTypes = tradesOnly ? ['trade'] : undefined;
      const events = await fetchTapeEvents({
        sessionId,
        eventTypes: eventTypes as import('@ai-exchange/types').TapeEventType[] | undefined,
        limit: showEvents,
      });

      for (const event of events) {
        const time = `[${event.timestamp}ms]`.padEnd(12);
        const id = event.id.padEnd(12);

        if (event.type === 'trade') {
          const trade = (event as TradeEvent).trade;
          console.log(`${time} ${id} TRADE: ${trade.quantity}@${trade.price} (${trade.buyAgentId} <- ${trade.sellAgentId})`);
        } else if (event.type === 'order_placed') {
          const order = (event as { order: { side: string; quantity: number; price: number; agentId: string } }).order;
          console.log(`${time} ${id} ORDER: ${order.side.toUpperCase()} ${order.quantity}@${order.price} (${order.agentId})`);
        } else if (event.type === 'news') {
          const news = event as { headline: string };
          console.log(`${time} ${id} NEWS: ${news.headline}`);
        } else {
          console.log(`${time} ${id} ${event.type.toUpperCase()}`);
        }
      }
      console.log('');
    }

    // OHLCV summary
    if (session.status === 'completed') {
      console.log('PRICE SUMMARY (OHLCV)');
      console.log('-'.repeat(60));

      const ohlcv = getOHLCV(sessionId, 1000);
      if (ohlcv.length > 0) {
        const opens = ohlcv.map(c => c.open);
        const highs = ohlcv.map(c => c.high);
        const lows = ohlcv.map(c => c.low);
        const closes = ohlcv.map(c => c.close);
        const volumes = ohlcv.map(c => c.volume);

        console.log(`Candles: ${ohlcv.length}`);
        console.log(`Open: ${opens[0]} -> Close: ${closes[closes.length - 1]}`);
        console.log(`High: ${Math.max(...highs)} | Low: ${Math.min(...lows)}`);
        console.log(`Total Volume: ${volumes.reduce((a, b) => a + b, 0)}`);
      }
      console.log('');

      // Check for report
      const report = getReport(sessionId);
      if (report) {
        console.log('FORENSICS REPORT');
        console.log('-'.repeat(60));
        console.log(`Generated: ${report.generatedAt}`);
        console.log(`Timeline entries: ${report.timeline.length}`);
        console.log(`Hypotheses: ${report.hypotheses.length}`);
        console.log(`Anomalies: ${report.anomalies.length}`);
        console.log('');
        console.log('Summary:');
        console.log(report.summary.slice(0, 300) + (report.summary.length > 300 ? '...' : ''));
      } else {
        console.log('No forensics report found. Run: pnpm investigate ' + sessionId);
      }
    }

    console.log('');

  } catch (error) {
    console.error('Failed to show session:', error);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
