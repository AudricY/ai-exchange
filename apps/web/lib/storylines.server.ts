import type { Storyline } from '@ai-exchange/types';
import { readFileSync } from 'fs';
import { join } from 'path';

export function loadStoryline(id: string): Storyline {
  const storylinesDir = join(process.cwd(), 'storylines');
  const filePath = join(storylinesDir, `${id}.json`);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Storyline;
}
