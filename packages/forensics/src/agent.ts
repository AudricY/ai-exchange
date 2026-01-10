import { generateText, streamText, stepCountIs, hasToolCall, LanguageModelUsage } from 'ai';
import { google } from '@ai-sdk/google';
import { createSessionTools } from './tools/index.js';
import { SYSTEM_PROMPT, INVESTIGATION_PROMPT } from './prompts.js';
import type { ForensicsReport } from '@ai-exchange/types';

export interface ToolCallStep {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export interface ToolResultStep {
  type: 'tool_result';
  callId: string;
  name: string;
  result: unknown;
  timestamp: number;
}

export interface ThinkingStep {
  type: 'thinking';
  content: string;
  timestamp: number;
}

export type InvestigationStep = ToolCallStep | ToolResultStep | ThinkingStep;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface InvestigationResult {
  report: ForensicsReport | null;
  usage: TokenUsage;
  stepCount: number;
  elapsedMs: number;
}

export interface InvestigateOptions {
  sessionId: string;
  onStep?: (step: InvestigationStep) => void;
  maxSteps?: number;  // Default: 100
}

/**
 * Extract report from generateText result steps
 */
function extractReport(steps: Array<{ toolResults: Array<{ toolName: string; output?: unknown }> }>): ForensicsReport | null {
  for (const step of steps) {
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
}

/**
 * Run a forensic investigation on a market session
 */
export async function investigate(
  options: InvestigateOptions
): Promise<InvestigationResult> {
  const {
    sessionId,
    onStep,
    maxSteps = 100,
  } = options;

  const startTime = Date.now();

  // Create session-scoped tools (sessionId is bound via closure)
  const tools = createSessionTools(sessionId);

  try {
    const result = await generateText({
      model: google('gemini-3-pro-preview'),
      system: SYSTEM_PROMPT,
      prompt: INVESTIGATION_PROMPT,
      tools,
      stopWhen: [
        stepCountIs(maxSteps),
        hasToolCall('emit_report'),
      ],
      onStepFinish: ({ text, toolCalls, toolResults }) => {
        // Emit thinking/reasoning
        if (text && onStep) {
          onStep({
            type: 'thinking',
            content: text,
            timestamp: Date.now(),
          });
        }

        // Emit tool calls with full input
        if (toolCalls && onStep) {
          for (const call of toolCalls) {
            onStep({
              type: 'tool_call',
              id: call.toolCallId,
              name: call.toolName,
              input: call.input as Record<string, unknown>,
              timestamp: Date.now(),
            });
          }
        }

        // Emit tool results
        if (toolResults && onStep) {
          for (const result of toolResults) {
            onStep({
              type: 'tool_result',
              callId: result.toolCallId,
              name: result.toolName,
              result: result.output,
              timestamp: Date.now(),
            });
          }
        }
      },
    });

    const report = extractReport(result.steps);

    return {
      report,
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
      stepCount: result.steps.length,
      elapsedMs: Date.now() - startTime,
    };
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
  const { sessionId, maxSteps = 100 } = options;

  // Create session-scoped tools (sessionId is bound via closure)
  const tools = createSessionTools(sessionId);

  const result = streamText({
    model: google('gemini-3-pro-preview'),
    system: SYSTEM_PROMPT,
    prompt: INVESTIGATION_PROMPT,
    tools,
    stopWhen: [
      stepCountIs(maxSteps),
      hasToolCall('emit_report'),
    ],
  });

  return {
    async *[Symbol.asyncIterator]() {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          yield {
            type: 'thinking' as const,
            content: part.text,
            timestamp: Date.now(),
          };
        } else if (part.type === 'tool-call') {
          yield {
            type: 'tool_call' as const,
            id: part.toolCallId,
            name: part.toolName,
            input: part.input as Record<string, unknown>,
            timestamp: Date.now(),
          };
        } else if (part.type === 'tool-result') {
          yield {
            type: 'tool_result' as const,
            callId: part.toolCallId,
            name: part.toolName,
            result: part.output,
            timestamp: Date.now(),
          };
        }
      }
    },
  };
}
