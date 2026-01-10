'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRESETS, type PresetKey } from '@/lib/presets';

interface PresetSelectorProps {
  selected: PresetKey;
  onSelect: (key: PresetKey) => void;
}

export function PresetSelector({ selected, onSelect }: PresetSelectorProps) {
  const presetEntries = Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {presetEntries.map(([key, preset]) => (
        <Card
          key={key}
          className={`cursor-pointer transition-all hover:border-primary ${
            selected === key ? 'border-primary ring-2 ring-primary/20' : ''
          }`}
          onClick={() => onSelect(key)}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">{preset.name}</h4>
              {selected === key && (
                <Badge variant="default" className="text-xs">Selected</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{preset.description}</p>
            <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
              <span>{preset.config.agents.length} agents</span>
              <span>|</span>
              <span>{preset.config.newsSchedule.length} news</span>
              <span>|</span>
              <span>{preset.config.durationMs / 1000}s</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
