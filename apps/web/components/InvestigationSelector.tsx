'use client';

import type { ForensicsReport } from '@ai-exchange/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';

interface Investigation {
  id: string;
  title: string;
  report: ForensicsReport;
  generatedAt: string;
}

interface InvestigationSelectorProps {
  investigations: Investigation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartNew: () => void;
  isStartingNew: boolean;
  hasRunning: boolean;
}

export function InvestigationSelector({
  investigations,
  selectedId,
  onSelect,
  onStartNew,
  isStartingNew,
  hasRunning,
}: InvestigationSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      {investigations.length > 0 && (
        <Select value={selectedId ?? undefined} onValueChange={onSelect}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select an investigation" />
          </SelectTrigger>
          <SelectContent>
            {investigations.map((inv) => (
              <SelectItem key={inv.id} value={inv.id}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{inv.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(inv.generatedAt).toLocaleString()}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button
        onClick={onStartNew}
        disabled={isStartingNew || hasRunning}
        variant={investigations.length === 0 ? 'default' : 'outline'}
        size="sm"
        className={investigations.length === 0 ? 'bg-purple-600 hover:bg-purple-700' : ''}
      >
        <PlusIcon className="h-4 w-4 mr-1" />
        {investigations.length === 0 ? 'Start Investigation' : 'New'}
      </Button>
    </div>
  );
}
