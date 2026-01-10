#!/usr/bin/env tsx
/**
 * CLI script to run forensics investigation on a session
 * Usage: pnpm investigate <sessionId>
 */

import { investigate, type InvestigationStep } from '@ai-exchange/forensics';
import { getSession, getReport, closeDb } from '@ai-exchange/db';

function parseArgs(): { sessionId: string } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: pnpm investigate <sessionId>

Arguments:
  sessionId    The session ID to investigate

Environment:
  GOOGLE_GENERATIVE_AI_API_KEY    Required for Gemini API access

Example:
  pnpm investigate session-1234567890-abc123def
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  return { sessionId: args[0] };
}

async function main() {
  const { sessionId } = parseArgs();

  // Check for API key
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
    console.error('Set it with: export GOOGLE_GENERATIVE_AI_API_KEY=your_key_here');
    process.exit(1);
  }

  // Verify session exists
  const session = getSession(sessionId);
  if (!session) {
    console.error(`Error: Session not found: ${sessionId}`);
    process.exit(1);
  }

  if (session.status !== 'completed') {
    console.error(`Error: Session is not completed (status: ${session.status})`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Forensics Investigation');
  console.log('='.repeat(60));
  console.log(`Session ID: ${sessionId}`);
  console.log(`Name: ${session.name}`);
  console.log(`Events: ${session.eventCount}`);
  console.log(`Trades: ${session.tradeCount}`);
  console.log('='.repeat(60));
  console.log('\nStarting investigation...\n');

  let stepCount = 0;
  const startTime = Date.now();

  try {
    const report = await investigate({
      sessionId,
      onStep: (step: InvestigationStep) => {
        stepCount++;
        const prefix = `[Step ${stepCount}]`;

        if (step.type === 'tool_call') {
          console.log(`${prefix} Tool: ${step.name}`);
          console.log(`        ${step.content}`);
        } else if (step.type === 'text') {
          console.log(`${prefix} Thought:`);
          console.log(`        ${step.content.slice(0, 200)}${step.content.length > 200 ? '...' : ''}`);
        } else if (step.type === 'thought') {
          console.log(`${prefix} ${step.content}`);
        }
        console.log('');
      },
    });

    const elapsed = Date.now() - startTime;

    console.log('='.repeat(60));
    console.log('Investigation Complete');
    console.log('='.repeat(60));
    console.log(`Steps: ${stepCount}`);
    console.log(`Time: ${elapsed}ms`);
    console.log('');

    if (report) {
      console.log('SUMMARY');
      console.log('-'.repeat(60));
      console.log(report.summary);
      console.log('');

      console.log('TIMELINE');
      console.log('-'.repeat(60));
      for (const entry of report.timeline) {
        const time = `[${entry.timestamp}ms]`.padEnd(12);
        const sig = `(${entry.significance})`.padEnd(10);
        console.log(`${time} ${sig} ${entry.description}`);
      }
      console.log('');

      console.log('HYPOTHESES');
      console.log('-'.repeat(60));
      for (const hyp of report.hypotheses) {
        const status = hyp.status === 'supported' ? '[+]' : hyp.status === 'rejected' ? '[-]' : '[?]';
        console.log(`${status} ${hyp.description} (confidence: ${(hyp.confidence * 100).toFixed(0)}%)`);
      }
      console.log('');

      if (report.anomalies.length > 0) {
        console.log('ANOMALIES DETECTED');
        console.log('-'.repeat(60));
        for (const anomaly of report.anomalies) {
          console.log(`[!] ${anomaly.type}: ${anomaly.description}`);
          console.log(`    Confidence: ${(anomaly.confidence * 100).toFixed(0)}%`);
        }
        console.log('');
      }

      console.log('CONCLUSION');
      console.log('-'.repeat(60));
      console.log(report.conclusion);
      console.log('');
    } else {
      console.log('No report generated. The investigation may have been incomplete.');
    }

  } catch (error) {
    console.error('\nInvestigation failed:', error);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
