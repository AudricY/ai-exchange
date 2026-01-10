#!/usr/bin/env tsx
/**
 * Generate a market storyline using AI
 * Usage: pnpm tsx scripts/generate-storyline.ts --theme "oil company" [--duration 60000] [--chaos 0.3] [--output path]
 */

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type { Storyline } from '@ai-exchange/types';

// Parse CLI arguments
function parseArgs(): {
  theme: string;
  duration: number;
  chaos: number;
  output: string;
} {
  const args = process.argv.slice(2);
  let theme = 'technology company';
  let duration = 60000;
  let chaos = 0.3;
  let output = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) {
      theme = args[++i];
    } else if (args[i] === '--duration' && args[i + 1]) {
      duration = parseInt(args[++i], 10);
    } else if (args[i] === '--chaos' && args[i + 1]) {
      chaos = parseFloat(args[++i]);
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: pnpm tsx scripts/generate-storyline.ts [options]

Options:
  --theme <theme>      Company/market theme (default: "technology company")
  --duration <ms>      Simulation duration in ms (default: 60000)
  --chaos <0-1>        Ratio of noise news (default: 0.3)
  --output <path>      Output file path (default: storylines/<theme>-<timestamp>.json)
  --help, -h           Show this help message
`);
      process.exit(0);
    }
  }

  // Generate default output path
  if (!output) {
    const slug = theme.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const timestamp = Date.now();
    output = path.join(process.cwd(), 'storylines', `${slug}-${timestamp}.json`);
  }

  return { theme, duration, chaos, output };
}

// Zod schema for storyline
const StorylineSchema = z.object({
  theme: z.string(),
  companyName: z.string(),
  companyDescription: z.string(),
  initialPrice: z.number(),
  events: z.array(
    z.object({
      timestamp: z.number(),
      headline: z.string(),
      content: z.string(),
      source: z.string(),
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      category: z.enum(['material', 'noise']),
      magnitude: z.enum(['low', 'medium', 'high']).optional(),
    })
  ),
  groundTruth: z.object({
    narrative: z.string(),
    keyMoments: z.array(
      z.object({
        timestamp: z.number(),
        description: z.string(),
        expectedPriceDirection: z.enum(['up', 'down', 'flat']),
      })
    ),
  }),
});

const STORYLINE_PROMPT = `Generate a realistic market simulation storyline for a stock market simulation.

Theme: {theme}
Duration: {duration}ms (timestamps should be spread across this duration, starting from 0)
Noise ratio: approximately {chaos}% of news should be irrelevant noise

Create a coherent narrative with:
1. A company profile fitting the theme (name, description, realistic initial stock price)
2. A sequence of 8-15 news events that tell a story
3. Mix of material news (has sentiment: positive/negative) and noise (sentiment: neutral)
4. Material news headlines should be ambiguous - require domain knowledge to interpret
5. At least one narrative arc (setup -> development -> resolution)
6. Timestamps spread throughout the duration (e.g., 5000, 15000, 25000, etc.)

Material news examples (headlines look neutral but have clear sentiment):
- "EPA schedules review of offshore permits" -> sentiment: negative (regulatory risk)
- "New CEO appointed from competitor firm" -> sentiment: positive (fresh leadership)
- "Q3 revenue guidance under review" -> sentiment: negative (uncertainty)
- "Strategic partnership announced with major retailer" -> sentiment: positive

Noise news examples (neutral sentiment, completely unrelated):
- "Weather forecast: Sunny skies expected this weekend" -> sentiment: neutral
- "Local sports team advances to playoffs" -> sentiment: neutral
- "Celebrity announces new product line" -> sentiment: neutral
- "Annual charity event raises record funds" -> sentiment: neutral

Important:
- The informed trading agent in the simulation will react to positive/negative sentiment
- The forensics agent will NOT see sentiment - it must infer from price action
- Make material news headlines subtle - they shouldn't obviously telegraph sentiment
- Include realistic news sources (Reuters, Bloomberg, CNBC, WSJ, etc.)
`;

async function main() {
  const { theme, duration, chaos, output } = parseArgs();

  console.log('='.repeat(60));
  console.log('Storyline Generator');
  console.log('='.repeat(60));
  console.log(`Theme: ${theme}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Noise ratio: ${Math.round(chaos * 100)}%`);
  console.log(`Output: ${output}`);
  console.log('='.repeat(60));
  console.log('\nGenerating storyline with AI...\n');

  try {
    const result = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: StorylineSchema,
      prompt: STORYLINE_PROMPT
        .replace('{theme}', theme)
        .replace('{duration}', String(duration))
        .replace('{chaos}', String(Math.round(chaos * 100))),
    });

    const storyline: Storyline = {
      id: `storyline-${Date.now()}`,
      durationMs: duration,
      ...result.object,
    };

    // Ensure output directory exists
    const outputDir = path.dirname(output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write storyline to file
    fs.writeFileSync(output, JSON.stringify(storyline, null, 2));

    console.log('='.repeat(60));
    console.log('Storyline Generated');
    console.log('='.repeat(60));
    console.log(`Company: ${storyline.companyName}`);
    console.log(`Description: ${storyline.companyDescription}`);
    console.log(`Initial Price: $${storyline.initialPrice}`);
    console.log(`Events: ${storyline.events.length}`);
    console.log(`  - Material: ${storyline.events.filter((e) => e.category === 'material').length}`);
    console.log(`  - Noise: ${storyline.events.filter((e) => e.category === 'noise').length}`);
    console.log(`Key Moments: ${storyline.groundTruth.keyMoments.length}`);
    console.log('');
    console.log('Ground Truth Narrative:');
    console.log('-'.repeat(60));
    console.log(storyline.groundTruth.narrative);
    console.log('-'.repeat(60));
    console.log('');
    console.log(`Storyline saved to: ${output}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  pnpm tsx scripts/simulate.ts --storyline ${output}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Failed to generate storyline:', error);
    process.exit(1);
  }
}

main();
