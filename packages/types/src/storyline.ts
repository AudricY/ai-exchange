/**
 * Storyline types for AI-generated market simulation narratives
 */

export interface StorylineEvent {
  timestamp: number;
  headline: string;
  content: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  category: 'material' | 'noise';
  magnitude?: 'low' | 'medium' | 'high';
}

export interface KeyMoment {
  timestamp: number;
  description: string;
  expectedPriceDirection: 'up' | 'down' | 'flat';
}

export interface GroundTruth {
  narrative: string;
  keyMoments: KeyMoment[];
}

export interface Storyline {
  id: string;
  theme: string;
  companyName: string;
  companyDescription: string;
  initialPrice: number;
  durationMs: number;
  events: StorylineEvent[];
  groundTruth: GroundTruth;
}
