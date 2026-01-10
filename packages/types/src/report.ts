export type HypothesisStatus = 'investigating' | 'supported' | 'rejected';

export interface EvidenceRef {
  eventId?: string;
  docChunkId?: string;
  description: string;
  timestamp?: number;
}

export interface Hypothesis {
  id: string;
  description: string;
  status: HypothesisStatus;
  confidence: number; // 0-1
  supportingEvidence: EvidenceRef[];
  contradictingEvidence: EvidenceRef[];
}

export interface CausalLink {
  cause: EvidenceRef;
  effect: EvidenceRef;
  explanation: string;
}

export interface AnomalyFlag {
  type:
    | 'spoofing'
    | 'momentum_ignition'
    | 'wash_trading'
    | 'rumor_cascade'
    | 'other';
  description: string;
  evidence: EvidenceRef[];
  confidence: number;
}

export interface TimelineEntry {
  timestamp: number;
  description: string;
  significance: 'low' | 'medium' | 'high';
  evidenceRefs: EvidenceRef[];
}

export interface ForensicsReport {
  sessionId: string;
  generatedAt: string;
  summary: string;
  timeline: TimelineEntry[];
  hypotheses: Hypothesis[];
  causalChain: CausalLink[];
  anomalies: AnomalyFlag[];
  conclusion: string;
}
