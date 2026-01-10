#!/usr/bin/env tsx
/**
 * CLI script to run forensics investigation on a session
 * Usage: pnpm investigate <sessionId>
 */

import { investigate, type InvestigationStep } from '@ai-exchange/forensics';
import { getSession, getReport, closeDb } from '@ai-exchange/db';
import { mkdirSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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

  // Set up log file
  const logsDir = join(process.cwd(), 'data', 'sessions', sessionId);
  mkdirSync(logsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = join(logsDir, `investigation-${timestamp}.log`);

  const log = (message: string) => {
    console.log(message);
    appendFileSync(logFile, message + '\n');
  };

  log('='.repeat(60));
  log('Forensics Investigation');
  log('='.repeat(60));
  log(`Session ID: ${sessionId}`);
  log(`Name: ${session.name}`);
  log(`Events: ${session.eventCount}`);
  log(`Trades: ${session.tradeCount}`);
  log(`Log file: ${logFile}`);
  log('='.repeat(60));
  log('\nStarting investigation...\n');

  let stepCount = 0;
  const startTime = Date.now();
  const steps: Array<{ step: number; timestamp: number; type: string; name?: string; content: string }> = [];

  try {
    const report = await investigate({
      sessionId,
      onStep: (step: InvestigationStep) => {
        stepCount++;
        const elapsed = Date.now() - startTime;
        const prefix = `[Step ${stepCount}] [${elapsed}ms]`;

        // Store step for detailed log
        steps.push({
          step: stepCount,
          timestamp: elapsed,
          type: step.type,
          name: step.name,
          content: step.content,
        });

        if (step.type === 'tool_call') {
          log(`${prefix} Tool: ${step.name}`);
          log(`        ${step.content}`);
        } else if (step.type === 'text') {
          log(`${prefix} Thought:`);
          log(`        ${step.content.slice(0, 200)}${step.content.length > 200 ? '...' : ''}`);
        } else if (step.type === 'thought') {
          log(`${prefix} ${step.content}`);
        }
        log('');
      },
    });

    const elapsed = Date.now() - startTime;

    log('='.repeat(60));
    log('Investigation Complete');
    log('='.repeat(60));
    log(`Steps: ${stepCount}`);
    log(`Time: ${elapsed}ms`);
    log('');

    if (report) {
      log('SUMMARY');
      log('-'.repeat(60));
      log(report.summary);
      log('');

      log('TIMELINE');
      log('-'.repeat(60));
      for (const entry of report.timeline) {
        const time = `[${entry.timestamp}ms]`.padEnd(12);
        const sig = `(${entry.significance})`.padEnd(10);
        log(`${time} ${sig} ${entry.description}`);
      }
      log('');

      log('HYPOTHESES');
      log('-'.repeat(60));
      for (const hyp of report.hypotheses) {
        const status = hyp.status === 'supported' ? '[+]' : hyp.status === 'rejected' ? '[-]' : '[?]';
        log(`${status} ${hyp.description} (confidence: ${(hyp.confidence * 100).toFixed(0)}%)`);
      }
      log('');

      if (report.anomalies.length > 0) {
        log('ANOMALIES DETECTED');
        log('-'.repeat(60));
        for (const anomaly of report.anomalies) {
          log(`[!] ${anomaly.type}: ${anomaly.description}`);
          log(`    Confidence: ${(anomaly.confidence * 100).toFixed(0)}%`);
        }
        log('');
      }

      log('CONCLUSION');
      log('-'.repeat(60));
      log(report.conclusion);
      log('');

      // Write detailed JSON log with full step contents
      const detailedLogFile = logFile.replace('.log', '-detailed.json');
      writeFileSync(detailedLogFile, JSON.stringify({
        sessionId,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        elapsedMs: elapsed,
        stepCount,
        steps,
        report,
      }, null, 2));
      log(`Detailed log: ${detailedLogFile}`);
    } else {
      log('No report generated. The investigation may have been incomplete.');
    }

    log(`\nLog file saved: ${logFile}`);

  } catch (error) {
    console.error('\nInvestigation failed:', error);
    appendFileSync(logFile, `\nInvestigation failed: ${error}\n`);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
