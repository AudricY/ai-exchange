export interface StorylineOption {
  id: string;
  name: string;
  description: string;
  duration: string;
}

export const STORYLINE_OPTIONS: StorylineOption[] = [
  {
    id: 'ai-company-crisis',
    name: 'AI Company Crisis',
    description: 'NeuralPath Systems navigates a security crisis',
    duration: '20 min',
  },
  {
    id: 'biotech-fda-drama',
    name: 'Biotech FDA Drama',
    description: 'AxonGene Biotics FDA approval journey',
    duration: '20 min',
  },
  {
    id: 'space-launch-drama',
    name: 'Space Launch Drama',
    description: 'Astraion Aerospace attempts historic lunar landing',
    duration: '20 min',
  },
];
