'use client';

import type { TapeEvent, NewsEvent, RumorEvent, DocInjectEvent } from '@ai-exchange/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface NewsFeedProps {
  events: TapeEvent[];
  maxItems?: number;
}

type NewsLikeEvent = NewsEvent | RumorEvent | DocInjectEvent;

function isNewsLikeEvent(e: TapeEvent): e is NewsLikeEvent {
  return e.type === 'news' || e.type === 'rumor' || e.type === 'doc_inject';
}

function getSentimentVariant(sentiment: 'positive' | 'negative' | 'neutral' | undefined) {
  switch (sentiment) {
    case 'positive':
      return 'default';
    case 'negative':
      return 'destructive';
    case 'neutral':
    default:
      return 'secondary';
  }
}

function getSentimentClass(sentiment: 'positive' | 'negative' | 'neutral' | undefined) {
  return sentiment === 'positive' ? 'bg-green-600' : '';
}

function getSentimentLabel(sentiment: 'positive' | 'negative' | 'neutral' | undefined) {
  return sentiment ?? 'news';
}

export function NewsFeed({ events, maxItems = 30 }: NewsFeedProps) {
  const newsEvents = events
    .filter(isNewsLikeEvent)
    .slice(-maxItems)
    .reverse();

  if (newsEvents.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-4">No news yet</div>
    );
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-2">
        {newsEvents.map((event) => (
          <div key={event.id} className="text-sm p-2 rounded bg-muted">
            {event.type === 'news' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={getSentimentVariant(event.sentiment)}
                    className={getSentimentClass(event.sentiment)}
                  >
                    {getSentimentLabel(event.sentiment)}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{event.source}</span>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <div className="font-medium">{event.headline}</div>
                {event.content && (
                  <div className="text-muted-foreground text-xs mt-1 line-clamp-2">
                    {event.content}
                  </div>
                )}
              </>
            )}
            {event.type === 'rumor' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">rumor</Badge>
                  <span className="text-muted-foreground text-xs">
                    Agent: {event.agentId}
                  </span>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <div className="italic text-muted-foreground">{event.message}</div>
              </>
            )}
            {event.type === 'doc_inject' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary">document</Badge>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <div>{event.title}</div>
                <div className="text-xs text-muted-foreground">
                  {event.chunkCount} chunks
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor(timestamp / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
