# Lumevo Studio

## Overview
An AI-powered creator platform for influencers and content creators. Users build projects, upload media, define their content vibe and tone, generate AI-written captions/titles/content structure, and clone their voice to hear generated content read back in their own voice.

## Architecture
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4 + inline CSS variables (pastel yellow / red accent theme)
- **Package Manager**: npm
- **Port**: 5000 (configured for Replit)
- **Storage**: localStorage (no server-side database — all data is client-side)

## Key Files
- `app/page.tsx` — Landing page
- `app/dashboard/page.tsx` — Project dashboard with voice clone count
- `app/project/[id]/page.tsx` — Project hub with nav cards
- `app/project/[id]/script/page.tsx` — Content brief + AI generation
- `app/project/[id]/upload/page.tsx` — Media upload (images & videos)
- `app/project/[id]/voice/page.tsx` — Global voice repository + voice clone feature
- `app/api/generate/content/route.ts` — OpenAI content generation endpoint
- `app/api/voice/clone/route.ts` — ElevenLabs voice clone endpoint (via Replit connectors)
- `app/api/voice/synthesize/route.ts` — ElevenLabs TTS endpoint (via Replit connectors)
- `lib/types.ts` — Shared TypeScript types (Project, VoiceEntry, etc.)
- `lib/projectStore.ts` — Per-project localStorage CRUD
- `lib/voiceStore.ts` — Global voice library localStorage CRUD (shared across all projects)
- `lib/audioExtract.ts` — Client-side audio extraction from video files (Web Audio API → WAV)
- `lib/aiGeneration.ts` — Client-side functions to call the content generation API

## Integrations
- **OpenAI** via Replit AI Integrations — content generation (captions, titles, structure). No personal API key needed; billed to Replit credits. Env vars: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **ElevenLabs** via Replit Connectors — voice cloning and text-to-speech. Authenticated via OAuth connector, no raw API key in code.

## Voice Repository
- Voices are stored globally in localStorage under `lumevo_voice_library`
- Each `VoiceEntry` has: id, elevenLabsId, name, personality tags, createdAt, usedInProjects[], sampleCount
- Users upload audio or video files; video audio is extracted client-side via Web Audio API before sending to ElevenLabs
- Voices can be reused across any project — clone once, use everywhere
- Dashboard shows voice clone count in the stats row

## Running the App
```bash
npm run dev    # Development server on port 5000
npm run build  # Production build
npm run start  # Production server on port 5000
```
