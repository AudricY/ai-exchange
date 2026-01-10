import { generateText, streamText, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import {
  getSessionManifest,
  fetchTape,
  getOHLCVData,
  getBookSnapshots,
  computeMicrostructureMetrics,
  emitReport,
} from './tools/index.js';
import { SYSTEM_PROMPT, INVESTIGATION_PROMPT } from './prompts.js';
import type { ForensicsReport } from '@ai-exchange/types';

const tools = {
  get_session_manifest: getSessionManifest,
  fetch_tape: fetchTape,
  get_ohlcv: getOHLCVData,
  get_book_snapshots: getBookSnapshots,
  compute_microstructure_metrics: computeMicrostructureMetrics,
  emit_report: emitReport,
};

export interface InvestigationStep {
  type: 'tool_call' | 'thought' | 'text';
  name?: string;
  content: string;
}

export interface InvestigateOptions {
  sessionId: string;
  onStep?: (step: InvestigationStep) => void;
  maxSteps?: number;
}

/**
 * Run a forensic investigation on a market session
 */
export async function investigate(
  options: InvestigateOptions
): Promise<ForensicsReport | null> {
  const { sessionId, onStep, maxSteps = 15 } = options;

  try {
    const result = await generateText({
      model: google('gemini-3-pro-preview'),
      system: SYSTEM_PROMPT,
      prompt: `${INVESTIGATION_PROMPT}\n\nSession ID: ${sessionId}`,
      tools,
      stopWhen: stepCountIs(maxSteps),
      onStepFinish: ({ text, toolCalls, toolResults }) => {
        if (text && onStep) {
          onStep({ type: 'text', content: text });
        }

        if (toolCalls && onStep) {
          for (const call of toolCalls) {
            onStep({
              type: 'tool_call',
              name: call.toolName,
              content: `${call.toolName}(${JSON.stringify(call.input).slice(0, 100)}...)`,
            });
          }
        }
      },
    });

    // Extract report from tool results
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        if (toolResult.toolName === 'emit_report' && toolResult.output) {
          const resultData = toolResult.output as { success: boolean; report: ForensicsReport };
          if (resultData.success && resultData.report) {
            return resultData.report;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Investigation failed:', error);
    throw error;
  }
}

/**
 * Run investigation with streaming output
 */
export async function investigateStream(
  options: InvestigateOptions
): Promise<AsyncIterable<InvestigationStep>> {
  const { sessionId, maxSteps = 15 } = options;

  const result = streamText({
    model: google('gemini-3-pro-preview'),
    system: SYSTEM_PROMPT,
    prompt: `${INVESTIGATION_PROMPT}\n\nSession ID: ${sessionId}`,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });

  return {
    async *[Symbol.asyncIterator]() {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          yield { type: 'text' as const, content: part.text };
        } else if (part.type === 'tool-call') {
          yield {
            type: 'tool_call' as const,
            name: part.toolName,
            content: `Calling ${part.toolName}...`,
          };
        } else if (part.type === 'tool-result') {
          yield {
            type: 'thought' as const,
            content: `Got result from ${part.toolName}`,
          };
        }
      }
    },
  };
}
