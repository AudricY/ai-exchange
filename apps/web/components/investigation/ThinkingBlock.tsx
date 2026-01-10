'use client';

import { Brain } from 'lucide-react';

interface ThinkingBlockProps {
  content: string;
  timestamp: number;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function ThinkingBlock({ content, timestamp }: ThinkingBlockProps) {
  // Skip empty or whitespace-only content
  if (!content.trim()) {
    return null;
  }

  return (
    <div className="flex gap-3 py-2">
      <div className="flex-shrink-0">
        <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Brain className="h-3 w-3 text-purple-400" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
        <div className="text-xs text-muted-foreground/60 mt-1">
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
}
