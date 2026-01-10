#!/usr/bin/env tsx
/**
 * CLI script to list all sessions
 * Usage: pnpm sessions
 */

import { listSessions, closeDb } from '@ai-exchange/db';

function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: pnpm sessions

Lists all simulation sessions with their status and statistics.
`);
    process.exit(0);
  }

  try {
    const sessions = listSessions();

    if (sessions.length === 0) {
      console.log('No sessions found.');
      console.log('Run "pnpm simulate" to create a new session.');
      return;
    }

    console.log('='.repeat(100));
    console.log('Sessions');
    console.log('='.repeat(100));
    console.log('');

    // Header
    const idCol = 'ID'.padEnd(45);
    const statusCol = 'Status'.padEnd(12);
    const eventsCol = 'Events'.padEnd(10);
    const tradesCol = 'Trades'.padEnd(10);
    const priceCol = 'Final'.padEnd(10);
    console.log(`${idCol} ${statusCol} ${eventsCol} ${tradesCol} ${priceCol}`);
    console.log('-'.repeat(100));

    // Rows
    for (const session of sessions) {
      const id = session.id.padEnd(45);
      const status = session.status.padEnd(12);
      const events = String(session.eventCount).padEnd(10);
      const trades = String(session.tradeCount).padEnd(10);
      const price = session.finalPrice ? session.finalPrice.toFixed(2).padEnd(10) : '-'.padEnd(10);

      console.log(`${id} ${status} ${events} ${trades} ${price}`);
    }

    console.log('');
    console.log(`Total: ${sessions.length} session(s)`);

  } catch (error) {
    console.error('Failed to list sessions:', error);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
