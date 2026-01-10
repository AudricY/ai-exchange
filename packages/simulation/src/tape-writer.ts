import { createWriteStream, WriteStream, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { TapeEvent, TapeEventType } from '@ai-exchange/types';

// Helper type to properly omit from union types
type OmitFromUnion<T, K extends keyof T> = T extends T ? Omit<T, K> : never;
export type TapeEventInput = OmitFromUnion<TapeEvent, 'id' | 'sequence'>;

/**
 * Append-only writer for tape events (JSONL format)
 */
export class TapeWriter {
  private stream: WriteStream;
  private sequence = 0;
  private fileOffset = 0;
  private onIndex?: (
    eventId: string,
    eventType: TapeEventType,
    timestamp: number,
    sequence: number,
    offset: number
  ) => void;

  constructor(
    filePath: string,
    onIndex?: (
      eventId: string,
      eventType: TapeEventType,
      timestamp: number,
      sequence: number,
      offset: number
    ) => void
  ) {
    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.stream = createWriteStream(filePath, { flags: 'a' });
    this.onIndex = onIndex;
  }

  /**
   * Write an event to the tape
   * Returns the generated event ID
   */
  write(event: TapeEventInput): string {
    const id = `EVT-${String(++this.sequence).padStart(6, '0')}`;
    const fullEvent = { ...event, id, sequence: this.sequence } as TapeEvent;
    const line = JSON.stringify(fullEvent) + '\n';

    // Track offset for indexing
    const currentOffset = this.fileOffset;
    this.fileOffset += Buffer.byteLength(line, 'utf8');

    this.stream.write(line);

    // Notify indexer if provided
    if (this.onIndex) {
      this.onIndex(id, event.type, event.timestamp, this.sequence, currentOffset);
    }

    return id;
  }

  /**
   * Get current sequence number
   */
  getSequence(): number {
    return this.sequence;
  }

  /**
   * Close the write stream
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.end((err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
