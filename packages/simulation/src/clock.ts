/**
 * Simulated clock for controlling time in the simulation
 */
export class SimClock {
  private currentTime: number;

  constructor(startTime: number = 0) {
    this.currentTime = startTime;
  }

  /**
   * Get current simulation time
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Advance time by delta milliseconds
   */
  advance(deltaMs: number): number {
    this.currentTime += deltaMs;
    return this.currentTime;
  }

  /**
   * Set absolute time
   */
  setTime(time: number): void {
    this.currentTime = time;
  }

  /**
   * Reset clock to start time
   */
  reset(startTime: number = 0): void {
    this.currentTime = startTime;
  }
}
