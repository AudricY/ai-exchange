---
description: "Generate a market simulation storyline with AI-created news events and ground truth"
argument-hint: "<theme> [--duration <ms>] [--chaos <0-1>] [--output <path>]"
allowed-tools: ["Write", "Read", "Bash"]
---

# Storyline Generator

Generate a realistic market simulation storyline for ForensiX.

## Arguments

Parse the user's arguments:
- `<theme>` (required): Company/market theme (e.g., "biotech company", "oil exploration firm")
- `--duration <ms>`: Simulation duration in milliseconds (default: 60000)
- `--chaos <0-1>`: Ratio of noise news events (default: 0.3)
- `--output <path>`: Output file path (default: `apps/web/storylines/<theme-slug>-<timestamp>.json`)

## Output Schema

Generate a JSON file matching this TypeScript interface:

```typescript
interface Storyline {
  id: string;                    // "storyline-<timestamp>"
  theme: string;                 // User's theme
  companyName: string;           // Fictional company name fitting theme
  companyDescription: string;    // 1-2 sentence company profile
  initialPrice: number;          // Realistic stock price ($20-$500)
  durationMs: number;            // From --duration
  events: StorylineEvent[];      // 8-15 news events
  groundTruth: GroundTruth;      // Narrative + key moments
}

interface StorylineEvent {
  timestamp: number;             // Milliseconds from start (0 to durationMs)
  headline: string;              // News headline
  content: string;               // Full news content (1-2 sentences)
  source: string;                // Reuters, Bloomberg, CNBC, WSJ, TechCrunch, etc.
  sentiment: "positive" | "negative" | "neutral";
  category: "material" | "noise";
  magnitude?: "low" | "medium" | "high";  // Only for material news
}

interface GroundTruth {
  narrative: string;             // Overall story summary (2-3 sentences)
  keyMoments: KeyMoment[];       // 3-5 critical price-action points
}

interface KeyMoment {
  timestamp: number;
  description: string;
  expectedPriceDirection: "up" | "down" | "flat";
}
```

## Generation Guidelines

### Material News (category: "material")
- Has positive or negative sentiment that should move the stock price
- Headlines should be AMBIGUOUS - require domain knowledge to interpret sentiment
- The forensics AI will NOT see sentiment labels - it must infer from price action
- Include magnitude: "low", "medium", or "high"

Good material headlines (subtle, require interpretation):
- "EPA schedules review of offshore drilling permits" → negative (regulatory risk)
- "CFO transitions to advisory role effective immediately" → negative (leadership instability)
- "Strategic partnership announced with major cloud provider" → positive
- "Q3 revenue guidance under review" → negative (uncertainty)
- "New CEO appointed from competitor firm" → positive (fresh leadership)

### Noise News (category: "noise")
- Always neutral sentiment
- Completely unrelated to the company or industry
- About {chaos * 100}% of events should be noise

Noise examples:
- "Weather forecast: Sunny skies expected this weekend"
- "Local sports team advances to playoffs"
- "City council approves bicycle infrastructure expansion"
- "Regional park service announces new trail maps"

### Narrative Structure
Create a coherent story arc:
1. **Setup**: Initial positive or neutral state
2. **Development**: Rising/falling action with material events
3. **Climax**: Peak crisis or opportunity moment
4. **Resolution**: Recovery or new equilibrium

Spread events across the full duration with realistic timing gaps.

## Execution Steps

1. Parse user arguments (theme, duration, chaos, output)
2. Generate the storyline JSON following the schema and guidelines above
3. Create output directory if needed
4. Write the JSON file with 2-space indentation
5. Report what was created and suggest next command:
   ```
   pnpm simulate --storyline <output-path>
   ```
