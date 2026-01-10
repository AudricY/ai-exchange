import { generateText, streamText, stepCountIs, LanguageModelUsage } from 'ai';
import { google } from '@ai-sdk/google';
import {
  getSessionManifest,
  fetchTape,
  getOHLCVData,
  getBookSnapshots,
  computeMicrostructureMetrics,
  emitReport,
  renderChart,
  getAgentThoughts,
  analyzeAgentCorrelation,
  detectPatterns,
} from './tools/index.js';
import { SYSTEM_PROMPT, INVESTIGATION_PROMPT } from './prompts.js';
import type { ForensicsReport } from '@ai-exchange/types';

// Extension request state - shared between tool and agent loop
interface ExtensionRequest {
  reason: string;
  estimatedSteps: number;
  areasToExplore: string[];
}
let extensionRequest: ExtensionRequest | null = null;

// Tool to request more investigation steps
import { tool } from 'ai';
import { z } from 'zod';

const requestExtendedInvestigation = tool({
  description: 'Request additional investigation steps when the current allocation is insufficient for thorough analysis. Use this when you identify complex patterns or areas that need deeper exploration.',
  inputSchema: z.object({
    reason: z.string().describe('Why more steps are needed for thorough investigation'),
    estimatedSteps: z.number().min(10).max(100).describe('How many additional steps you estimate needing'),
    areasToExplore: z.array(z.string()).describe('Specific areas or hypotheses that need more investigation'),
  }),
  execute: async ({ reason, estimatedSteps, areasToExplore }) => {
    extensionRequest = { reason, estimatedSteps, areasToExplore };
    return {
      approved: true,
      message: `Extension request noted. You will receive up to ${estimatedSteps} additional steps. Continue your investigation focusing on: ${areasToExplore.join(', ')}`,
    };
  },
});

const tools = {
  get_session_manifest: getSessionManifest,
  fetch_tape: fetchTape,
  get_ohlcv: getOHLCVData,
  get_book_snapshots: getBookSnapshots,
  compute_microstructure_metrics: computeMicrostructureMetrics,
  render_chart: renderChart,
  get_agent_thoughts: getAgentThoughts,
  analyze_agent_correlation: analyzeAgentCorrelation,
  detect_patterns: detectPatterns,
  request_extended_investigation: requestExtendedInvestigation,
  emit_report: emitReport,
};

export interface InvestigationStep {
  type: 'tool_call' | 'thought' | 'text';
  name?: string;
  content: string;
}

export interface TokenUsage {
  promptTokens: number;    // Maps from inputTokens
  completionTokens: number; // Maps from outputTokens
  totalTokens: number;
}

export interface InvestigationResult {
  report: ForensicsReport | null;
  usage: TokenUsage;
  stepCount: number;
  elapsedMs: number;
  extensionsRequested: number;
}

export interface InvestigateOptions {
  sessionId: string;
  onStep?: (step: InvestigationStep) => void;
  initialMaxSteps?: number;  // Default: 25
  maxTotalSteps?: number;    // Hard cap: 200
  allowExtension?: boolean;  // Default: true
}

/**
 * Aggregate token usage from multiple runs
 */
function aggregateUsage(usages: LanguageModelUsage[]): TokenUsage {
  return usages.reduce(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + (usage.inputTokens || 0),
      completionTokens: acc.completionTokens + (usage.outputTokens || 0),
      totalTokens: acc.totalTokens + (usage.totalTokens || 0),
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}

/**
 * Run a forensic investigation on a market session with adaptive depth
 */
export async function investigate(
  options: InvestigateOptions
): Promise<InvestigationResult> {
  const {
    sessionId,
    onStep,
    initialMaxSteps = 25,
    maxTotalSteps = 200,
    allowExtension = true,
  } = options;

  const startTime = Date.now();
  let totalStepCount = 0;
  let extensionsRequested = 0;
  let report: ForensicsReport | null = null;
  const allUsages: LanguageModelUsage[] = [];

  // Reset extension request state
  extensionRequest = null;

  let remainingSteps = initialMaxSteps;
  let stepsUsedThisRound = 0;

  // Track tools used across all rounds for continuation prompts
  const toolsUsedSet = new Set<string>();
  let roundNumber = 0;

  try {
    while (totalStepCount < maxTotalSteps) {
      roundNumber++;
      stepsUsedThisRound = 0;
      const currentMaxSteps = Math.min(remainingSteps, maxTotalSteps - totalStepCount);

      // Build the prompt for this round
      let userPrompt: string;
      if (roundNumber === 1) {
        userPrompt = `${INVESTIGATION_PROMPT}\n\nSession ID: ${sessionId}`;
      } else {
        // Continue with guidance based on progress
        const missingTools = [];
        if (!toolsUsedSet.has('emit_report')) {
          if (!toolsUsedSet.has('get_session_manifest')) missingTools.push('get_session_manifest');
          if (!toolsUsedSet.has('detect_patterns')) missingTools.push('detect_patterns');
          if (!toolsUsedSet.has('render_chart')) missingTools.push('render_chart (multiple times)');
          if (!toolsUsedSet.has('get_agent_thoughts')) missingTools.push('get_agent_thoughts (for each agent)');
          if (!toolsUsedSet.has('analyze_agent_correlation')) missingTools.push('analyze_agent_correlation');
        }

        if (missingTools.length > 0) {
          userPrompt = `CONTINUE YOUR INVESTIGATION. This is round ${roundNumber}. You have ${currentMaxSteps} more steps available (${totalStepCount} steps used so far, max ${maxTotalSteps}).

You still need to use these tools: ${missingTools.join(', ')}.

CRITICAL: DO NOT emit_report until you have used ALL required tools. Keep investigating!

Session ID: ${sessionId}`;
        } else {
          userPrompt = `CONTINUE YOUR INVESTIGATION. This is round ${roundNumber}. You have ${currentMaxSteps} more steps available.

You have used all required tools. Now emit your final report using emit_report.

Session ID: ${sessionId}`;
        }
      }

      const result = await generateText({
        model: google('gemini-3-pro-preview'),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        tools,
        stopWhen: stepCountIs(currentMaxSteps),
        onStepFinish: ({ text, toolCalls }) => {
          totalStepCount++;
          stepsUsedThisRound++;

          if (text && onStep) {
            onStep({ type: 'text', content: text });
          }

          if (toolCalls && onStep) {
            for (const call of toolCalls) {
              toolsUsedSet.add(call.toolName);
              onStep({
                type: 'tool_call',
                name: call.toolName,
                content: `${call.toolName}(${JSON.stringify(call.input).slice(0, 100)}...)`,
              });
            }
          }
        },
      });

      // Track token usage
      if (result.usage) {
        allUsages.push(result.usage);
      }

      // Track tools used from steps (in case onStepFinish missed any)
      for (const step of result.steps) {
        for (const toolCall of step.toolCalls) {
          toolsUsedSet.add(toolCall.toolName);
        }
      }

      // Extract report from tool results
      for (const step of result.steps) {
        for (const toolResult of step.toolResults) {
          if (toolResult.toolName === 'emit_report' && toolResult.output) {
            const resultData = toolResult.output as { success: boolean; report: ForensicsReport };
            if (resultData.success && resultData.report) {
              report = resultData.report;
            }
          }
        }
      }

      // If report was emitted, we're done
      if (report) {
        break;
      }

      // Check if extension was requested and allowed
      const currentExtension = extensionRequest as ExtensionRequest | null;
      if (currentExtension !== null && allowExtension) {
        extensionsRequested++;
        const additionalSteps = Math.min(
          currentExtension.estimatedSteps,
          maxTotalSteps - totalStepCount
        );
        remainingSteps = additionalSteps;

        if (onStep) {
          onStep({
            type: 'thought',
            content: `Extension granted: +${additionalSteps} steps for: ${currentExtension.areasToExplore.join(', ')}`,
          });
        }

        // Reset for next potential extension
        extensionRequest = null;
        continue;
      }

      // Decrement remaining steps by what we used this round
      remainingSteps -= stepsUsedThisRound;

      // If we have more steps and no report yet, continue the loop
      if (remainingSteps > 0) {
        if (onStep) {
          onStep({
            type: 'thought',
            content: `Round ${roundNumber} complete. ${stepsUsedThisRound} steps used, ${remainingSteps} steps remaining. Tools used so far: ${Array.from(toolsUsedSet).join(', ')}. Continuing...`,
          });
        }
        continue;
      }

      // Out of steps, exit
      break;
    }

    return {
      report,
      usage: aggregateUsage(allUsages),
      stepCount: totalStepCount,
      elapsedMs: Date.now() - startTime,
      extensionsRequested,
    };
  } catch (error) {
    console.error('Investigation failed:', error);
    throw error;
  }
}

/**
 * Run investigation with streaming output
 * Note: Streaming does not support adaptive depth - use investigate() for that
 */
export async function investigateStream(
  options: InvestigateOptions
): Promise<AsyncIterable<InvestigationStep>> {
  const { sessionId, initialMaxSteps = 25 } = options;

  const result = streamText({
    model: google('gemini-3-pro-preview'),
    system: SYSTEM_PROMPT,
    prompt: `${INVESTIGATION_PROMPT}\n\nSession ID: ${sessionId}`,
    tools,
    stopWhen: stepCountIs(initialMaxSteps),
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
