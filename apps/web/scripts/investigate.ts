#!/usr/bin/env tsx
/**
 * CLI script to run forensics investigation on a session
 * Usage: pnpm investigate <sessionId> [options]
 */

import 'dotenv/config';
import { investigate, type InvestigationStep, type InvestigationResult } from '@ai-exchange/forensics';
import { getSession, closeDb, generateInvestigationId, setInvestigationStatus } from '@ai-exchange/db';
import { mkdirSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ParsedArgs {
  sessionId: string;
  maxSteps?: number;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: pnpm investigate <sessionId> [options]

Arguments:
  sessionId    The session ID to investigate

Options:
  --max-steps <n>    Maximum steps for investigation (default: 100)

Environment:
  GOOGLE_GENERATIVE_AI_API_KEY    Required for Gemini API access

Examples:
  pnpm investigate session-123456
  pnpm investigate session-123456 --max-steps 50
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const result: ParsedArgs = {
    sessionId: args[0],
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--max-steps' && args[i + 1]) {
      result.maxSteps = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return result;
}

async function main() {
  const { sessionId, maxSteps } = parseArgs();

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
  log(`Max steps: ${maxSteps || 100}`);
  log(`Log file: ${logFile}`);
  log('='.repeat(60));
  log('\nStarting investigation...\n');

  let stepCount = 0;
  const startTime = Date.now();
  const steps: Array<{ step: number; timestamp: number; type: string; name?: string; content: string }> = [];

  // Generate investigation ID for CLI usage
  const investigationId = generateInvestigationId(sessionId);
  setInvestigationStatus(investigationId, sessionId, 'running');

  try {
    const result: InvestigationResult = await investigate({
      sessionId,
      investigationId,
      maxSteps: maxSteps || 100,
      onStep: (step: InvestigationStep) => {
        stepCount++;
        const elapsed = Date.now() - startTime;
        const prefix = `[Step ${stepCount}] [${elapsed}ms]`;

        // Store step for detailed log based on type
        if (step.type === 'tool_call') {
          const inputPreview = JSON.stringify(step.input).slice(0, 100);
          steps.push({
            step: stepCount,
            timestamp: elapsed,
            type: step.type,
            name: step.name,
            content: inputPreview,
          });
          log(`${prefix} Tool: ${step.name}`);
          log(`        Input: ${inputPreview}...`);
        } else if (step.type === 'tool_result') {
          const resultPreview = JSON.stringify(step.result).slice(0, 100);
          steps.push({
            step: stepCount,
            timestamp: elapsed,
            type: step.type,
            name: step.name,
            content: resultPreview,
          });
          log(`${prefix} Result: ${step.name}`);
          log(`        ${resultPreview}...`);
        } else if (step.type === 'thinking') {
          steps.push({
            step: stepCount,
            timestamp: elapsed,
            type: step.type,
            content: step.content,
          });
          log(`${prefix} Thinking:`);
          log(`        ${step.content.slice(0, 200)}${step.content.length > 200 ? '...' : ''}`);
        }
        log('');
      },
    });

    log('='.repeat(60));
    log('Investigation Complete');
    log('='.repeat(60));
    log(`Steps: ${result.stepCount}`);
    log(`Time: ${result.elapsedMs}ms`);
    log('');

    // Token usage section
    log('TOKEN USAGE');
    log('-'.repeat(60));
    log(`Prompt tokens:     ${result.usage.promptTokens.toLocaleString()}`);
    log(`Completion tokens: ${result.usage.completionTokens.toLocaleString()}`);
    log(`Total tokens:      ${result.usage.totalTokens.toLocaleString()}`);
    log('');

    const report = result.report;

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

      // Write detailed JSON log with full step contents and token usage
      const detailedLogFile = logFile.replace('.log', '-detailed.json');
      writeFileSync(detailedLogFile, JSON.stringify({
        sessionId,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        elapsedMs: result.elapsedMs,
        stepCount: result.stepCount,
        tokenUsage: result.usage,
        steps,
        report,
      }, null, 2));
      log(`Detailed log: ${detailedLogFile}`);
    } else {
      log('No report generated. The investigation may have been incomplete.');
    }

    log(`\nLog file saved: ${logFile}`);

    // Mark investigation as completed
    setInvestigationStatus(investigationId, sessionId, 'completed');

  } catch (error) {
    console.error('\nInvestigation failed:', error);
    appendFileSync(logFile, `\nInvestigation failed: ${error}\n`);
    setInvestigationStatus(investigationId, sessionId, 'failed');
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
