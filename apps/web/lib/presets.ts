import type { SessionConfig, AgentConfig, NewsScheduleItem } from '@ai-exchange/types';

export interface Preset {
  name: string;
  description: string;
  config: SessionConfig;
}

export type PresetKey = 'basic' | 'highVolatility' | 'newsHeavy' | 'marketMaker';

// Default params for each archetype
export const ARCHETYPE_DEFAULTS: Record<string, Record<string, number | string | boolean>> = {
  market_maker: { spread: 2, orderSize: 50 },
  noise: { orderProbability: 0.3, priceRange: 5, orderSize: 10 },
  momentum: { lookbackPeriod: 10, threshold: 0.02, orderSize: 20 },
  informed: { orderSize: 100, reactionStrength: 1.0 },
};

export const ARCHETYPE_LABELS: Record<string, string> = {
  market_maker: 'Market Maker',
  noise: 'Noise Trader',
  momentum: 'Momentum Trader',
  informed: 'Informed Trader',
};

export const PRESETS: Record<PresetKey, Preset> = {
  basic: {
    name: 'Basic',
    description: '1 minute simulation with balanced agents',
    config: {
      seed: Date.now(),
      durationMs: 60000,
      tickSize: 1,
      initialPrice: 100,
      agents: [
        {
          id: 'mm-1',
          name: 'Market Maker 1',
          archetype: 'market_maker',
          params: { spread: 2, orderSize: 50 },
        },
        {
          id: 'noise-1',
          name: 'Noise Trader 1',
          archetype: 'noise',
          params: { orderProbability: 0.3, priceRange: 5, orderSize: 10 },
        },
        {
          id: 'noise-2',
          name: 'Noise Trader 2',
          archetype: 'noise',
          params: { orderProbability: 0.25, priceRange: 3, orderSize: 15 },
        },
        {
          id: 'momentum-1',
          name: 'Momentum Trader',
          archetype: 'momentum',
          params: { lookbackPeriod: 10, threshold: 0.02, orderSize: 20 },
        },
        {
          id: 'informed-1',
          name: 'Informed Trader',
          archetype: 'informed',
          params: { orderSize: 100, reactionStrength: 1.0 },
        },
      ],
      newsSchedule: [
        {
          timestamp: 15000,
          headline: 'Positive earnings report released',
          content: 'Company XYZ reported earnings above expectations.',
          sentiment: 'positive',
          source: 'Financial Times',
        },
        {
          timestamp: 35000,
          headline: 'Market uncertainty increases',
          content: 'Analysts express concerns about upcoming economic data.',
          sentiment: 'negative',
          source: 'Reuters',
        },
      ],
      docInjects: [],
    },
  },
  highVolatility: {
    name: 'High Volatility',
    description: 'Fast-moving market with aggressive traders',
    config: {
      seed: Date.now(),
      durationMs: 60000,
      tickSize: 1,
      initialPrice: 100,
      agents: [
        {
          id: 'momentum-1',
          name: 'Momentum Trader 1',
          archetype: 'momentum',
          params: { lookbackPeriod: 5, threshold: 0.01, orderSize: 30 },
        },
        {
          id: 'momentum-2',
          name: 'Momentum Trader 2',
          archetype: 'momentum',
          params: { lookbackPeriod: 8, threshold: 0.015, orderSize: 25 },
        },
        {
          id: 'momentum-3',
          name: 'Momentum Trader 3',
          archetype: 'momentum',
          params: { lookbackPeriod: 3, threshold: 0.02, orderSize: 20 },
        },
        {
          id: 'noise-1',
          name: 'Noise Trader 1',
          archetype: 'noise',
          params: { orderProbability: 0.5, priceRange: 8, orderSize: 15 },
        },
        {
          id: 'noise-2',
          name: 'Noise Trader 2',
          archetype: 'noise',
          params: { orderProbability: 0.45, priceRange: 6, orderSize: 20 },
        },
        {
          id: 'noise-3',
          name: 'Noise Trader 3',
          archetype: 'noise',
          params: { orderProbability: 0.4, priceRange: 10, orderSize: 10 },
        },
        {
          id: 'noise-4',
          name: 'Noise Trader 4',
          archetype: 'noise',
          params: { orderProbability: 0.35, priceRange: 7, orderSize: 25 },
        },
      ],
      newsSchedule: [
        {
          timestamp: 10000,
          headline: 'Breaking: Major acquisition announced',
          content: 'Industry giant announces surprise acquisition.',
          sentiment: 'positive',
          source: 'Bloomberg',
        },
        {
          timestamp: 25000,
          headline: 'Regulatory concerns emerge',
          content: 'Government announces review of sector practices.',
          sentiment: 'negative',
          source: 'Reuters',
        },
        {
          timestamp: 45000,
          headline: 'Analyst upgrades rating',
          content: 'Leading analyst raises price target significantly.',
          sentiment: 'positive',
          source: 'CNBC',
        },
      ],
      docInjects: [],
    },
  },
  newsHeavy: {
    name: 'News Heavy',
    description: 'Multiple news events to test informed trading',
    config: {
      seed: Date.now(),
      durationMs: 90000,
      tickSize: 1,
      initialPrice: 100,
      agents: [
        {
          id: 'informed-1',
          name: 'Informed Trader 1',
          archetype: 'informed',
          params: { orderSize: 80, reactionStrength: 1.2 },
        },
        {
          id: 'informed-2',
          name: 'Informed Trader 2',
          archetype: 'informed',
          params: { orderSize: 60, reactionStrength: 0.8 },
        },
        {
          id: 'mm-1',
          name: 'Market Maker',
          archetype: 'market_maker',
          params: { spread: 2, orderSize: 40 },
        },
        {
          id: 'noise-1',
          name: 'Noise Trader 1',
          archetype: 'noise',
          params: { orderProbability: 0.2, priceRange: 3, orderSize: 10 },
        },
        {
          id: 'noise-2',
          name: 'Noise Trader 2',
          archetype: 'noise',
          params: { orderProbability: 0.25, priceRange: 4, orderSize: 15 },
        },
      ],
      newsSchedule: [
        {
          timestamp: 10000,
          headline: 'Q1 results preview looks promising',
          content: 'Industry analysts predict strong quarterly performance.',
          sentiment: 'positive',
          source: 'WSJ',
        },
        {
          timestamp: 25000,
          headline: 'Supply chain disruption reported',
          content: 'Key supplier faces production delays.',
          sentiment: 'negative',
          source: 'Reuters',
        },
        {
          timestamp: 40000,
          headline: 'New product launch successful',
          content: 'Company reports record pre-orders for new product line.',
          sentiment: 'positive',
          source: 'TechCrunch',
        },
        {
          timestamp: 55000,
          headline: 'CEO announces retirement',
          content: 'Long-serving CEO to step down at end of quarter.',
          sentiment: 'neutral',
          source: 'Bloomberg',
        },
        {
          timestamp: 75000,
          headline: 'Strategic partnership announced',
          content: 'Major partnership deal with industry leader finalized.',
          sentiment: 'positive',
          source: 'Financial Times',
        },
      ],
      docInjects: [],
    },
  },
  marketMaker: {
    name: 'Market Maker Focus',
    description: 'Test liquidity provision strategies',
    config: {
      seed: Date.now(),
      durationMs: 60000,
      tickSize: 1,
      initialPrice: 100,
      agents: [
        {
          id: 'mm-1',
          name: 'Market Maker (Tight)',
          archetype: 'market_maker',
          params: { spread: 1, orderSize: 100 },
        },
        {
          id: 'mm-2',
          name: 'Market Maker (Medium)',
          archetype: 'market_maker',
          params: { spread: 3, orderSize: 50 },
        },
        {
          id: 'mm-3',
          name: 'Market Maker (Wide)',
          archetype: 'market_maker',
          params: { spread: 5, orderSize: 30 },
        },
        {
          id: 'noise-1',
          name: 'Noise Trader 1',
          archetype: 'noise',
          params: { orderProbability: 0.3, priceRange: 4, orderSize: 20 },
        },
        {
          id: 'noise-2',
          name: 'Noise Trader 2',
          archetype: 'noise',
          params: { orderProbability: 0.25, priceRange: 3, orderSize: 15 },
        },
      ],
      newsSchedule: [
        {
          timestamp: 30000,
          headline: 'Market volatility expected to increase',
          content: 'Upcoming economic data release may cause price swings.',
          sentiment: 'neutral',
          source: 'Reuters',
        },
      ],
      docInjects: [],
    },
  },
};

// Helper to create a new agent with unique ID
export function createNewAgent(archetype: string): AgentConfig {
  const id = `${archetype}-${Date.now()}`;
  const name = `${ARCHETYPE_LABELS[archetype] || archetype} ${Math.floor(Math.random() * 100)}`;
  return {
    id,
    name,
    archetype: archetype as AgentConfig['archetype'],
    params: { ...ARCHETYPE_DEFAULTS[archetype] },
  };
}

// Helper to create a new news event
export function createNewNewsEvent(timestamp: number = 0): NewsScheduleItem {
  return {
    timestamp,
    headline: '',
    content: '',
    sentiment: 'neutral',
    source: '',
  };
}
