import { tool } from 'ai';
import { z } from 'zod';
import { saveReport } from '@ai-exchange/db';
import type { ForensicsReport } from '@ai-exchange/types';

const EvidenceRefSchema = z.object({
  eventId: z.string().optional(),
  docChunkId: z.string().optional(),
  description: z.string(),
  timestamp: z.number().optional(),
});

const HypothesisSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(['investigating', 'supported', 'rejected']),
  confidence: z.number().min(0).max(1),
  supportingEvidence: z.array(EvidenceRefSchema),
  contradictingEvidence: z.array(EvidenceRefSchema),
});

const TimelineEntrySchema = z.object({
  timestamp: z.number(),
  description: z.string(),
  significance: z.enum(['low', 'medium', 'high']),
  evidenceRefs: z.array(EvidenceRefSchema),
});

const CausalLinkSchema = z.object({
  cause: EvidenceRefSchema,
  effect: EvidenceRefSchema,
  explanation: z.string(),
});

const AnomalyFlagSchema = z.object({
  type: z.enum([
    'spoofing',
    'momentum_ignition',
    'wash_trading',
    'rumor_cascade',
    'other',
  ]),
  description: z.string(),
  evidence: z.array(EvidenceRefSchema),
  confidence: z.number().min(0).max(1),
});

export const emitReport = tool({
  description:
    'Emit the final forensics report with timeline, hypotheses, causal chain, and conclusions. Call this once investigation is complete.',
  parameters: z.object({
    sessionId: z.string(),
    summary: z.string().describe('Brief summary of what happened'),
    timeline: z.array(TimelineEntrySchema).describe('Key events in order'),
    hypotheses: z.array(HypothesisSchema).describe('Investigated hypotheses'),
    causalChain: z
      .array(CausalLinkSchema)
      .describe('Causal links between events'),
    anomalies: z.array(AnomalyFlagSchema).describe('Detected anomalies'),
    conclusion: z.string().describe('Final conclusion'),
  }),
  execute: async ({
    sessionId,
    summary,
    timeline,
    hypotheses,
    causalChain,
    anomalies,
    conclusion,
  }): Promise<{ success: boolean; report: ForensicsReport }> => {
    const report: ForensicsReport = {
      sessionId,
      generatedAt: new Date().toISOString(),
      summary,
      timeline,
      hypotheses,
      causalChain,
      anomalies,
      conclusion,
    };

    saveReport(sessionId, report);

    return { success: true, report };
  },
});
