# AutoInfluence AI

## Overview
A Next.js app that helps content creators turn raw content into branded short-form video ideas. Users describe their content, choose a vibe/tone/audience goal, and get AI-generated captions, title ideas, and content structure.

## Architecture
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4
- **Package Manager**: npm
- **Port**: 5000 (configured for Replit)

## Key Files
- `app/` — Next.js App Router pages and API routes
- `app/api/generate/content/route.ts` — Content generation API endpoint (currently returns mock data)
- `app/project/[id]/` — Individual project pages
- `lib/types.ts` — Shared TypeScript types and constants
- `lib/projectStore.ts` — Client-side localStorage persistence
- `lib/aiGeneration.ts` — Client-side functions to call the generation API

## Running the App
```bash
npm run dev    # Development server on port 5000
npm run build  # Production build
npm run start  # Production server on port 5000
```

## Notes
- Project data is stored in the browser's localStorage (no backend database)
- The content generation API currently uses mock data — connect an AI API (e.g. OpenAI) to enable real generation
- No environment variables are required to run in the current mock state
