'use client';

import type { NewsScheduleItem } from '@ai-exchange/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createNewNewsEvent } from '@/lib/presets';
import { Trash2, Plus } from 'lucide-react';

interface NewsScheduleEditorProps {
  newsSchedule: NewsScheduleItem[];
  durationMs: number;
  onChange: (newsSchedule: NewsScheduleItem[]) => void;
}

const SENTIMENTS = ['positive', 'negative', 'neutral'] as const;

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-muted-foreground',
};

export function NewsScheduleEditor({ newsSchedule, durationMs, onChange }: NewsScheduleEditorProps) {
  const handleAdd = () => {
    // Add new event at a sensible time (middle of simulation if empty, or after last event)
    const lastTime = newsSchedule.length > 0
      ? Math.max(...newsSchedule.map(n => n.timestamp))
      : 0;
    const newTime = Math.min(lastTime + 15000, durationMs - 5000);
    onChange([...newsSchedule, createNewNewsEvent(Math.max(0, newTime))]);
  };

  const handleRemove = (index: number) => {
    onChange(newsSchedule.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, updates: Partial<NewsScheduleItem>) => {
    const newSchedule = [...newsSchedule];
    newSchedule[index] = { ...newSchedule[index], ...updates };
    onChange(newSchedule);
  };

  // Sort by timestamp for display
  const sortedNews = [...newsSchedule]
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => a.item.timestamp - b.item.timestamp);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">News Schedule ({newsSchedule.length})</h3>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add News
        </Button>
      </div>

      <div className="space-y-3">
        {sortedNews.map(({ item, originalIndex }) => (
          <Card key={originalIndex}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground">Time (sec)</Label>
                      <Input
                        type="number"
                        value={item.timestamp / 1000}
                        onChange={(e) => handleChange(originalIndex, {
                          timestamp: Math.max(0, Math.min(parseFloat(e.target.value) * 1000, durationMs))
                        })}
                        min={0}
                        max={durationMs / 1000}
                        step={1}
                        className="h-8 mt-1"
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-muted-foreground">Sentiment</Label>
                      <Select
                        value={item.sentiment}
                        onValueChange={(value) => handleChange(originalIndex, {
                          sentiment: value as NewsScheduleItem['sentiment']
                        })}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SENTIMENTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              <span className={SENTIMENT_COLORS[s] + ' capitalize'}>{s}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Source</Label>
                      <Input
                        value={item.source}
                        onChange={(e) => handleChange(originalIndex, { source: e.target.value })}
                        placeholder="e.g. Reuters, Bloomberg"
                        className="h-8 mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Headline</Label>
                    <Input
                      value={item.headline}
                      onChange={(e) => handleChange(originalIndex, { headline: e.target.value })}
                      placeholder="News headline..."
                      className="h-8 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Content (optional)</Label>
                    <Input
                      value={item.content}
                      onChange={(e) => handleChange(originalIndex, { content: e.target.value })}
                      placeholder="Additional details..."
                      className="h-8 mt-1"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(originalIndex)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {newsSchedule.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No news events scheduled. The simulation will run without external news.
        </div>
      )}
    </div>
  );
}
