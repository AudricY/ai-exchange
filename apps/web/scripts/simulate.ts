#!/usr/bin/env tsx
/**
 * CLI script to run a market simulation
 * Usage: pnpm simulate [--name "Session Name"] [--duration 60000] [--seed 12345]
 */

import { createSession, getSession, closeDb } from '@ai-exchange/db';
import { SimulationRunner } from '@ai-exchange/simulation';
import type { SessionConfig } from '@ai-exchange/types';

// Parse CLI arguments
function parseArgs(): { name: string; duration: number; seed: number } {
  const args = process.argv.slice(2);
  let name = `CLI Session ${new Date().toISOString().slice(0, 19)}`;
  let duration = 60000;
  let seed = Date.now();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === '--duration' && args[i + 1]) {
      duration = parseInt(args[++i], 10);
    } else if (args[i] === '--seed' && args[i + 1]) {
      seed = parseInt(args[++i], 10);
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: pnpm simulate [options]

Options:
  --name <name>       Session name (default: "CLI Session <timestamp>")
  --duration <ms>     Simulation duration in ms (default: 60000)
  --seed <number>     Random seed for reproducibility (default: current timestamp)
  --help, -h          Show this help message
`);
      process.exit(0);
    }
  }

  return { name, duration, seed };
}

// Default session config
function createConfig(duration: number, seed: number): SessionConfig {
  return {
    seed,
    durationMs: duration,
    tickSize: 1,
    initialPrice: 100,
    agents: [
      {
        id: 'mm-1',
        name: 'Market Maker 1',
        archetype: 'market_maker',
        params: { spread: 2, orderSize: 50 },
      },
      {
        id: 'noise-1',
        name: 'Noise Trader 1',
        archetype: 'noise',
        params: { orderProbability: 0.3, priceRange: 5, orderSize: 10 },
      },
      {
        id: 'noise-2',
        name: 'Noise Trader 2',
        archetype: 'noise',
        params: { orderProbability: 0.25, priceRange: 3, orderSize: 15 },
      },
      {
        id: 'momentum-1',
        name: 'Momentum Trader',
        archetype: 'momentum',
        params: { lookbackPeriod: 10, threshold: 0.02, orderSize: 20 },
      },
      {
        id: 'informed-1',
        name: 'Informed Trader',
        archetype: 'informed',
        params: { orderSize: 100, reactionStrength: 1.0 },
      },
    ],
    newsSchedule: [
      {
        timestamp: Math.floor(duration * 0.25),
        headline: 'Positive earnings report released',
        content: 'Company XYZ reported earnings above expectations.',
        sentiment: 'positive',
        source: 'Financial Times',
      },
      {
        timestamp: Math.floor(duration * 0.6),
        headline: 'Market uncertainty increases',
        content: 'Analysts express concerns about upcoming economic data.',
        sentiment: 'negative',
        source: 'Reuters',
      },
    ],
    docInjects: [],
  };
}

async function main() {
  const { name, duration, seed } = parseArgs();
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const config = createConfig(duration, seed);

  console.log('='.repeat(60));
  console.log('Market Simulation');
  console.log('='.repeat(60));
  console.log(`Session ID: ${sessionId}`);
  console.log(`Name: ${name}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Seed: ${seed}`);
  console.log(`Agents: ${config.agents.length}`);
  console.log(`News Events: ${config.newsSchedule.length}`);
  console.log('='.repeat(60));

  try {
    // Create session in database
    console.log('\nCreating session...');
    createSession(sessionId, name, config);

    // Run simulation
    console.log('Starting simulation...');
    const startTime = Date.now();

    const runner = new SimulationRunner({
      sessionId,
      config,
    });

    await runner.run();

    const elapsed = Date.now() - startTime;

    // Get final session state
    const session = getSession(sessionId);

    console.log('\n' + '='.repeat(60));
    console.log('Simulation Complete');
    console.log('='.repeat(60));
    console.log(`Session ID: ${sessionId}`);
    console.log(`Status: ${session?.status}`);
    console.log(`Events: ${session?.eventCount}`);
    console.log(`Trades: ${session?.tradeCount}`);
    console.log(`Final Price: ${session?.finalPrice}`);
    console.log(`Real Time: ${elapsed}ms`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nSimulation failed:', error);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
