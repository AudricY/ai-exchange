import { tool } from 'ai';
import { z } from 'zod';
import { saveReport, generateInvestigationId } from '@ai-exchange/db';
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
  inputSchema: z.object({
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
  }: {
    sessionId: string;
    summary: string;
    timeline: Array<{ timestamp: number; description: string; significance: 'low' | 'medium' | 'high'; evidenceRefs: Array<{ eventId?: string; docChunkId?: string; description: string; timestamp?: number }> }>;
    hypotheses: Array<{ id: string; description: string; status: 'investigating' | 'supported' | 'rejected'; confidence: number; supportingEvidence: Array<{ eventId?: string; docChunkId?: string; description: string; timestamp?: number }>; contradictingEvidence: Array<{ eventId?: string; docChunkId?: string; description: string; timestamp?: number }> }>;
    causalChain: Array<{ cause: { eventId?: string; docChunkId?: string; description: string; timestamp?: number }; effect: { eventId?: string; docChunkId?: string; description: string; timestamp?: number }; explanation: string }>;
    anomalies: Array<{ type: 'spoofing' | 'momentum_ignition' | 'wash_trading' | 'rumor_cascade' | 'other'; description: string; evidence: Array<{ eventId?: string; docChunkId?: string; description: string; timestamp?: number }>; confidence: number }>;
    conclusion: string;
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

    const investigationId = generateInvestigationId(sessionId);
    saveReport(investigationId, sessionId, report);

    return { success: true, report };
  },
});
