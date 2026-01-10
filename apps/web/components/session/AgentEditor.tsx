'use client';

import type { AgentConfig } from '@ai-exchange/types';
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
import { ARCHETYPE_DEFAULTS, ARCHETYPE_LABELS, createNewAgent } from '@/lib/presets';
import { Trash2, Plus } from 'lucide-react';

interface AgentEditorProps {
  agents: AgentConfig[];
  onChange: (agents: AgentConfig[]) => void;
}

const ARCHETYPES = ['market_maker', 'noise', 'momentum', 'informed'] as const;

export function AgentEditor({ agents, onChange }: AgentEditorProps) {
  const handleAdd = () => {
    onChange([...agents, createNewAgent('noise')]);
  };

  const handleRemove = (index: number) => {
    onChange(agents.filter((_, i) => i !== index));
  };

  const handleAgentChange = (index: number, updates: Partial<AgentConfig>) => {
    const newAgents = [...agents];
    newAgents[index] = { ...newAgents[index], ...updates };
    onChange(newAgents);
  };

  const handleArchetypeChange = (index: number, archetype: string) => {
    const newAgents = [...agents];
    newAgents[index] = {
      ...newAgents[index],
      archetype: archetype as AgentConfig['archetype'],
      params: { ...ARCHETYPE_DEFAULTS[archetype] },
    };
    onChange(newAgents);
  };

  const handleParamChange = (index: number, param: string, value: number) => {
    const newAgents = [...agents];
    newAgents[index] = {
      ...newAgents[index],
      params: { ...newAgents[index].params, [param]: value },
    };
    onChange(newAgents);
  };

  const renderParams = (agent: AgentConfig, index: number) => {
    const params = Object.entries(agent.params);
    return (
      <div className="grid grid-cols-2 gap-3 mt-3">
        {params.map(([key, value]) => (
          <div key={key}>
            <Label className="text-xs text-muted-foreground capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </Label>
            <Input
              type="number"
              value={value as number}
              onChange={(e) => handleParamChange(index, key, parseFloat(e.target.value) || 0)}
              step={key.includes('Probability') || key.includes('threshold') || key.includes('Strength') ? 0.1 : 1}
              className="h-8 mt-1"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Agents ({agents.length})</h3>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Agent
        </Button>
      </div>

      <div className="space-y-3">
        {agents.map((agent, index) => (
          <Card key={agent.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={agent.name}
                        onChange={(e) => handleAgentChange(index, { name: e.target.value })}
                        className="h-8 mt-1"
                      />
                    </div>
                    <div className="w-40">
                      <Label className="text-xs text-muted-foreground">Archetype</Label>
                      <Select
                        value={agent.archetype}
                        onValueChange={(value) => handleArchetypeChange(index, value)}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ARCHETYPES.map((arch) => (
                            <SelectItem key={arch} value={arch}>
                              {ARCHETYPE_LABELS[arch]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {renderParams(agent, index)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No agents configured. Add at least one agent to run a simulation.
        </div>
      )}
    </div>
  );
}
