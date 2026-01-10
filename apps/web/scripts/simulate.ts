#!/usr/bin/env tsx
/**
 * CLI script to run a market simulation
 * Usage: pnpm simulate [--name "Session Name"] [--duration 60000] [--seed 12345] [--storyline path]
 */

import * as fs from 'fs';
import { createSession, getSession, closeDb } from '@ai-exchange/db';
import { SimulationRunner } from '@ai-exchange/simulation';
import type { SessionConfig, Storyline } from '@ai-exchange/types';

// Parse CLI arguments
function parseArgs(): { name: string; duration: number; seed: number; storylinePath: string | null } {
  const args = process.argv.slice(2);
  let name = `CLI Session ${new Date().toISOString().slice(0, 19)}`;
  let duration = 60000;
  let seed = Date.now();
  let storylinePath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === '--duration' && args[i + 1]) {
      duration = parseInt(args[++i], 10);
    } else if (args[i] === '--seed' && args[i + 1]) {
      seed = parseInt(args[++i], 10);
    } else if (args[i] === '--storyline' && args[i + 1]) {
      storylinePath = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: pnpm simulate [options]

Options:
  --name <name>       Session name (default: "CLI Session <timestamp>")
  --duration <ms>     Simulation duration in ms (default: 60000)
  --seed <number>     Random seed for reproducibility (default: current timestamp)
  --storyline <path>  Path to storyline JSON file (overrides duration/price/news)
  --help, -h          Show this help message
`);
      process.exit(0);
    }
  }

  return { name, duration, seed, storylinePath };
}

// Default session config
function createConfig(duration: number, seed: number): SessionConfig {
  return {
    seed,
    durationMs: duration,
    tickSize: 1,
    initialPrice: 100,
    agents: [
      // Liquidity provider
      {
        id: 'mm-1',
        name: 'Market Maker 1',
        archetype: 'market_maker',
        params: { spread: 2, orderSize: 50 },
      },
      // Random activity
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
        id: 'noise-3',
        name: 'Noise Trader 3',
        archetype: 'noise',
        params: { orderProbability: 0.2, priceRange: 4, orderSize: 12 },
      },
      // Trend followers (with trailing anchor for trend-following)
      {
        id: 'momentum-1',
        name: 'Momentum Trader 1',
        archetype: 'momentum',
        params: {
          lookbackPeriod: 10,
          threshold: 0.02,
          orderSize: 20,
          maxPosition: 150,
          anchorDecay: 0.03,
          maxDeviation: 1.0,
        },
      },
      {
        id: 'momentum-2',
        name: 'Momentum Trader 2',
        archetype: 'momentum',
        params: {
          lookbackPeriod: 20,
          threshold: 0.03,
          orderSize: 15,
          maxPosition: 100,
          anchorDecay: 0.05,
          maxDeviation: 1.0,
        },
      },
      // Instant news reaction (HFT-like)
      {
        id: 'informed-1',
        name: 'Informed Trader',
        archetype: 'informed',
        params: { orderSize: 100, reactionStrength: 1.0, maxPosition: 400 },
      },
      // Fair value anchors (react with lag, fair value drifts for trends)
      {
        id: 'fundamentals-1',
        name: 'Quick Analyst',
        archetype: 'fundamentals',
        params: {
          reactionLagMs: 3000,
          deviationThreshold: 0.03,
          orderSize: 40,
          maxPosition: 200,
          driftPerTick: 0.0002,
          volatilityPerTick: 0.0003,
        },
      },
      {
        id: 'fundamentals-2',
        name: 'Deep Value Investor',
        archetype: 'fundamentals',
        params: {
          reactionLagMs: 8000,
          deviationThreshold: 0.05,
          orderSize: 80,
          maxPosition: 400,
          driftPerTick: 0.00015,
          volatilityPerTick: 0.00025,
        },
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
  const { name, duration, seed, storylinePath } = parseArgs();
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Load storyline if provided
  let storyline: Storyline | undefined;
  if (storylinePath) {
    try {
      const content = fs.readFileSync(storylinePath, 'utf-8');
      storyline = JSON.parse(content) as Storyline;
    } catch (error) {
      console.error(`Failed to load storyline from ${storylinePath}:`, error);
      process.exit(1);
    }
  }

  // Create config (storyline will override some values in runner)
  const config = createConfig(
    storyline?.durationMs ?? duration,
    seed
  );

  // If storyline, use its initial price
  if (storyline) {
    config.initialPrice = storyline.initialPrice;
    config.newsSchedule = []; // Will be populated from storyline in runner
  }

  const effectiveDuration = storyline?.durationMs ?? duration;
  const effectiveName = storyline ? `${storyline.companyName} - ${name}` : name;

  console.log('='.repeat(60));
  console.log('Market Simulation');
  console.log('='.repeat(60));
  console.log(`Session ID: ${sessionId}`);
  console.log(`Name: ${effectiveName}`);
  if (storyline) {
    console.log(`Storyline: ${storylinePath}`);
    console.log(`Company: ${storyline.companyName}`);
    console.log(`Theme: ${storyline.theme}`);
  }
  console.log(`Duration: ${effectiveDuration}ms`);
  console.log(`Seed: ${seed}`);
  console.log(`Initial Price: $${config.initialPrice}`);
  console.log(`Agents: ${config.agents.length}`);
  console.log(`News Events: ${storyline?.events.length ?? config.newsSchedule.length}`);
  console.log('='.repeat(60));

  try {
    // Create session in database
    console.log('\nCreating session...');
    createSession(sessionId, effectiveName, config);

    // Run simulation
    console.log('Starting simulation...');
    const startTime = Date.now();

    const runner = new SimulationRunner({
      sessionId,
      config,
      storyline,
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
