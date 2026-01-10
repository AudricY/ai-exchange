# Shadcn UI Implementation Plan

This plan outlines the steps to integrate `shadcn/ui` into the `apps/web` project, utilizing the latest Tailwind CSS v4 features and standard shadcn practices.

## 1. Prerequisites & Installation

Since `apps/web` is already using Tailwind CSS v4, we will use the compatible version of `shadcn/ui`.

### Install Dependencies
Run the following in `apps/web`:
```bash
pnpm add lucide-react tailwind-merge clsx class-variance-authority
```

### Initialize shadcn/ui
Run the initialization command in `apps/web`:
```bash
npx shadcn@latest init
```
*Selection during init:*
- **Style**: New York (or Default)
- **Base color**: Slate (matches current dark theme)
- **CSS variables**: Yes
- **Location of global CSS**: `app/globals.css`
- **Location of components**: `components`
- **Location of UI components**: `components/ui`
- **Location of utils**: `lib/utils.ts`

## 2. Tailwind CSS v4 Configuration

`shadcn/ui` will automatically attempt to update `app/globals.css`. Ensure it includes the necessary `@theme` blocks for Tailwind v4 compatibility.

### Expected `app/globals.css` structure:
```css
@import "tailwindcss";

@plugin "tailwindcss-animate";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  /* ... other shadcn variables ... */
}

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

## 3. Core Component Integration

We will start by adding essential components needed for the "Market Transparency" features:

1.  **Layout & Navigation**:
    - `Tabs`: For switching between "Trades", "Orders", and "News".
    - `ScrollArea`: For the high-frequency order feed and agent logs.
    - `Separator`: For visual division in the `SessionPage`.

2.  **Information Display**:
    - `Card`: To wrap the `NewsFeed` and `AgentThoughts` panels.
    - `Badge`: For sentiment indicators (Positive/Negative) and event types.
    - `Table`: For structured data like the `OrderLifecycleFeed`.

3.  **Interactivity**:
    - `Tooltip`: For explaining agent rationale on hover.
    - `Button`: To replace custom buttons in the `InvestigationPanel` and `ReplayScrubber`.

### Adding a component example:
```bash
npx shadcn@latest add tabs card badge scroll-area
```

## 4. Refactoring Existing Components

The goal is to migrate existing components in `apps/web/components/` to use shadcn/ui primitives for a consistent look and feel.

### Step-by-step migration:
1.  **Identify**: Find components using raw Tailwind classes for layout/borders.
2.  **Replace**: Swap manual divs with `<Card>`, `<ScrollArea>`, etc.
3.  **Theme**: Use shadcn utility classes (e.g., `text-muted-foreground`, `bg-accent`) instead of hardcoded colors like `text-gray-400`.

## 5. Directory Structure

After implementation, the `apps/web` structure will look like:
```text
apps/web/
├── app/
│   └── globals.css
├── components/
│   ├── ui/                # shadcn primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── NewsFeed.tsx       # Uses ui/card.tsx
│   └── AgentThoughts.tsx  # Uses ui/scroll-area.tsx
├── lib/
│   └── utils.ts           # cn() helper
└── components.json        # shadcn config
```

## 6. Testing & Validation
- Verify dark mode consistency across all new components.
- Ensure the `ReplayScrubber` remains performant when wrapped in shadcn structures.
- Check accessibility (ARIA labels) provided by Radix UI (via shadcn).
