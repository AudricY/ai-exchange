import { join } from 'path';
import type {
  SessionConfig,
  AgentConfig,
  Trade,
  NewsEvent,
  TapeEvent,
  OHLCVBar,
  Storyline,
} from '@ai-exchange/types';
import { MatchingEngine } from '@ai-exchange/exchange';
import {
  indexTapeEvent,
  insertOHLCV,
  insertSnapshot,
  updateSessionStatus,
} from '@ai-exchange/db';
import { createRng } from './rng.js';
import { SimClock } from './clock.js';
import { TapeWriter } from './tape-writer.js';
import {
  BaseAgent,
  MarketState,
  AgentAction,
  NoiseTrader,
  MarketMaker,
  MomentumTrader,
  InformedTrader,
} from './agents/index.js';

export interface SimulationRunnerOptions {
  sessionId: string;
  config: SessionConfig;
  storyline?: Storyline;
  dataDir?: string;
  tickInterval?: number;
  snapshotInterval?: number;
  ohlcvResolution?: number;
}

/**
 * Main simulation runner - orchestrates the entire market simulation
 */
export class SimulationRunner {
  private sessionId: string;
  private config: SessionConfig;
  private dataDir: string;
  private tickInterval: number;
  private snapshotInterval: number;
  private ohlcvResolution: number;

  private rng: () => number;
  private clock: SimClock;
  private engine: MatchingEngine;
  private tape: TapeWriter;
  private agents: BaseAgent[] = [];

  // Tracking state
  private trades: Trade[] = [];
  private recentNews: NewsEvent[] = [];
  private newsQueue: Array<{ timestamp: number; news: Omit<NewsEvent, 'id' | 'sequence' | 'sessionId' | 'type'> }> = [];
  private eventCount = 0;
  private tradeCount = 0;

  // OHLCV aggregation
  private currentOHLCV: OHLCVBar | null = null;

  constructor(options: SimulationRunnerOptions) {
    this.sessionId = options.sessionId;
    this.config = options.config;
    this.dataDir = options.dataDir ?? join(process.cwd(), 'data');
    this.tickInterval = options.tickInterval ?? 100; // 100ms per tick
    this.snapshotInterval = options.snapshotInterval ?? 1000; // Snapshot every 1s
    this.ohlcvResolution = options.ohlcvResolution ?? 1000; // 1s candles

    // Initialize RNG with seed
    this.rng = createRng(this.config.seed);

    // Initialize clock
    this.clock = new SimClock(0);

    // Initialize tape writer
    const tapePath = join(
      this.dataDir,
      'sessions',
      this.sessionId,
      'tape.jsonl'
    );
    this.tape = new TapeWriter(tapePath, (eventId, eventType, timestamp, sequence, offset) => {
      this.eventCount++;
      indexTapeEvent(this.sessionId, eventId, eventType, timestamp, sequence, offset);
    });

    // Initialize matching engine
    this.engine = new MatchingEngine(
      this.sessionId,
      this.config.tickSize,
      (event) => {
        this.tape.write(event);
        if (event.type === 'trade') {
          const tradeEvent = event as Omit<import('@ai-exchange/types').TradeEvent, 'id' | 'sequence'>;
          this.tradeCount++;
          this.trades.push(tradeEvent.trade);
          this.updateOHLCV(tradeEvent.trade);
        }
      }
    );

    // Initialize agents
    this.initializeAgents();

    // Queue up news events - from storyline if provided, otherwise from config
    if (options.storyline) {
      // Use storyline events (includes sentiment for informed agents)
      this.newsQueue = options.storyline.events.map((event) => ({
        timestamp: event.timestamp,
        news: {
          headline: event.headline,
          content: event.content,
          sentiment: event.sentiment,
          source: event.source,
          timestamp: event.timestamp,
        },
      }));
      // Override config from storyline
      this.config.initialPrice = options.storyline.initialPrice;
      this.config.durationMs = options.storyline.durationMs;
    } else {
      // Use config news schedule
      this.newsQueue = this.config.newsSchedule.map((item) => ({
        timestamp: item.timestamp,
        news: {
          headline: item.headline,
          content: item.content,
          sentiment: item.sentiment,
          source: item.source,
          timestamp: item.timestamp,
        },
      }));
    }
    this.newsQueue.sort((a, b) => a.timestamp - b.timestamp);
  }

  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      const agent = this.createAgent(agentConfig);
      if (agent) {
        this.agents.push(agent);
      }
    }
  }

  private createAgent(config: AgentConfig): BaseAgent | null {
    // Create a new RNG for each agent (derived from main RNG)
    const agentRng = createRng(Math.floor(this.rng() * 2147483647));

    switch (config.archetype) {
      case 'noise':
        return new NoiseTrader(config, agentRng);
      case 'market_maker':
        return new MarketMaker(config, agentRng);
      case 'momentum':
        return new MomentumTrader(config, agentRng);
      case 'informed':
        return new InformedTrader(config, agentRng);
      default:
        console.warn(`Unknown agent archetype: ${config.archetype}`);
        return null;
    }
  }

  /**
   * Run the full simulation
   */
  async run(): Promise<void> {
    const endTime = this.config.durationMs;

    // Update session status to running
    updateSessionStatus(this.sessionId, 'running');

    // Seed the order book with initial orders
    await this.seedInitialOrders();

    let lastSnapshotTime = -this.snapshotInterval;

    // Main simulation loop
    while (this.clock.now() < endTime) {
      const timestamp = this.clock.now();

      // Process scheduled news
      this.processScheduledNews(timestamp);

      // Get current market state
      const state = this.getMarketState();

      // Each agent decides on actions
      for (const agent of this.agents) {
        const agentState = {
          ...state,
          position: agent.getPosition(),
          cash: agent.getCash(),
          openOrders: this.engine.getAgentOrders(agent.getId()),
        };

        const actions = agent.tick(timestamp, agentState);

        for (const action of actions) {
          this.executeAction(agent, action, timestamp);
        }
      }

      // Periodically emit snapshots
      if (timestamp - lastSnapshotTime >= this.snapshotInterval) {
        const snapshot = this.engine.emitSnapshot(timestamp);
        insertSnapshot(this.sessionId, timestamp, snapshot);
        lastSnapshotTime = timestamp;
      }

      // Clear old news from recent list
      this.recentNews = this.recentNews.filter(
        (n) => timestamp - n.timestamp < 5000
      );

      // Clear old trades
      this.trades = this.trades.filter((t) => timestamp - t.timestamp < 5000);

      // Advance time
      this.clock.advance(this.tickInterval);
    }

    // Final snapshot
    const finalSnapshot = this.engine.emitSnapshot(this.clock.now());
    insertSnapshot(this.sessionId, this.clock.now(), finalSnapshot);

    // Flush any remaining OHLCV
    if (this.currentOHLCV) {
      insertOHLCV(this.currentOHLCV);
    }

    // Close tape writer
    await this.tape.close();

    // Update session status
    updateSessionStatus(this.sessionId, 'completed', {
      eventCount: this.eventCount,
      tradeCount: this.tradeCount,
      finalPrice: finalSnapshot.lastTradePrice ?? undefined,
      completedAt: new Date().toISOString(),
    });
  }

  private async seedInitialOrders(): Promise<void> {
    const initialPrice = this.config.initialPrice;
    const timestamp = this.clock.now();

    // Place some initial orders around the initial price to bootstrap the book
    // Market maker will place orders around this price
    for (let i = 1; i <= 5; i++) {
      // Bids below initial price
      this.engine.placeOrder(
        {
          agentId: 'SEED',
          side: 'buy',
          type: 'limit',
          price: initialPrice - i * this.config.tickSize,
          quantity: 100,
        },
        timestamp
      );

      // Asks above initial price
      this.engine.placeOrder(
        {
          agentId: 'SEED',
          side: 'sell',
          type: 'limit',
          price: initialPrice + i * this.config.tickSize,
          quantity: 100,
        },
        timestamp
      );
    }

    // Initial snapshot
    const snapshot = this.engine.emitSnapshot(timestamp);
    insertSnapshot(this.sessionId, timestamp, snapshot);
  }

  private processScheduledNews(timestamp: number): void {
    while (this.newsQueue.length > 0 && this.newsQueue[0].timestamp <= timestamp) {
      const item = this.newsQueue.shift()!;

      // Full news for internal use (informed agents see sentiment)
      const fullNews: Omit<NewsEvent, 'id' | 'sequence'> = {
        sessionId: this.sessionId,
        type: 'news',
        timestamp,
        headline: item.news.headline,
        content: item.news.content,
        sentiment: item.news.sentiment,
        source: item.news.source,
      };

      // Write to tape WITHOUT sentiment (forensics can't see it)
      const tapeNews = {
        sessionId: this.sessionId,
        type: 'news' as const,
        timestamp,
        headline: item.news.headline,
        content: item.news.content,
        source: item.news.source,
        // NO sentiment field - forensics must infer from price action
      };

      const eventId = this.tape.write(tapeNews);
      const fullEvent: NewsEvent = {
        ...fullNews,
        id: eventId,
        sequence: this.tape.getSequence(),
      };
      this.recentNews.push(fullEvent);
    }
  }

  private getMarketState(): Omit<MarketState, 'position' | 'cash' | 'openOrders'> {
    const lastTrade = this.trades.length > 0 ? this.trades[this.trades.length - 1] : null;

    return {
      midPrice: this.engine.getMidPrice(),
      spread: this.engine.getSpread(),
      bestBid: this.engine.getBestBid(),
      bestAsk: this.engine.getBestAsk(),
      lastTrade,
      lastTradePrice: lastTrade?.price ?? null,
      recentNews: [...this.recentNews],
    };
  }

  private executeAction(agent: BaseAgent, action: AgentAction, timestamp: number): void {
    if (action.type === 'place_order' && action.orderRequest) {
      const result = this.engine.placeOrder(action.orderRequest, timestamp);

      // Update agent state for trades
      for (const trade of result.trades) {
        // Notify both agents involved in the trade
        for (const a of this.agents) {
          a.onTrade(trade);
        }
      }

      // Emit agent thought if provided
      if (action.thought) {
        this.tape.write({
          sessionId: this.sessionId,
          type: 'agent_thought' as const,
          timestamp,
          agentId: agent.getId(),
          thought: action.thought,
          action: `Placed ${action.orderRequest.side} order: ${action.orderRequest.quantity}@${action.orderRequest.price}`,
        });
      }
    } else if (action.type === 'cancel_order' && action.orderId) {
      this.engine.cancelOrder(action.orderId, timestamp);
    }
  }

  private updateOHLCV(trade: Trade): void {
    const intervalStart =
      Math.floor(trade.timestamp / this.ohlcvResolution) * this.ohlcvResolution;

    if (!this.currentOHLCV || this.currentOHLCV.intervalStart !== intervalStart) {
      // Save previous candle if exists
      if (this.currentOHLCV) {
        insertOHLCV(this.currentOHLCV);
      }

      // Start new candle
      this.currentOHLCV = {
        sessionId: this.sessionId,
        intervalStart,
        resolution: this.ohlcvResolution,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.quantity,
        tradeCount: 1,
      };
    } else {
      // Update current candle
      this.currentOHLCV.high = Math.max(this.currentOHLCV.high, trade.price);
      this.currentOHLCV.low = Math.min(this.currentOHLCV.low, trade.price);
      this.currentOHLCV.close = trade.price;
      this.currentOHLCV.volume += trade.quantity;
      this.currentOHLCV.tradeCount++;
    }
  }
}
