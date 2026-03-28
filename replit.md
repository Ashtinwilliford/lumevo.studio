# Lumevo Studio

## Overview
An AI-powered creator platform. Users sign up, build projects, upload media, define their content vibe and tone, generate AI-written captions/titles/content structure, clone their voice, and build a Brand Profile that trains on their content over time.

**Core tagline**: "You Upload. Lumevo Learns. We Create."

## Architecture
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Inline CSS (per-page style tags) + globals.css — pastel yellow (#F8F8A6) + vibrant red (#FF2D2D) brand
- **Fonts**: Fredoka One (logo/display), Syne (headings), DM Sans (body)
- **Package Manager**: npm
- **Port**: 5000 (configured for Replit)
- **Storage**: localStorage (no server-side database — all data is client-side)

## Design System
- **Background**: `#F8F8A6` (soft lemon yellow)
- **Accent**: `#FF2D2D` (vibrant red)
- **Surface**: `#FFFFFF`
- **Surface2**: `#F2F29A`
- **Logo font**: Fredoka One (bubbly/bold)
- **Heading font**: Syne (weight 700/800)
- **Body font**: DM Sans

## Pages
- `app/page.tsx` — Landing page with hero, features, pricing, and CTAs
- `app/login/page.tsx` — Login page (localStorage-based auth)
- `app/signup/page.tsx` — Signup page (creates account, redirects to dashboard)
- `app/pricing/page.tsx` — Full pricing page (4 tiers)
- `app/dashboard/page.tsx` — Full dashboard with sidebar (Overview, Projects, Brand Profile, Voice, Settings) — auth-gated
- `app/project/[id]/page.tsx` — Project hub with nav cards
- `app/project/[id]/script/page.tsx` — Content brief + AI generation
- `app/project/[id]/upload/page.tsx` — Media upload (images & videos)
- `app/project/[id]/voice/page.tsx` — Global voice repository + voice clone

## Key Library Files
- `lib/auth.ts` — Simple localStorage auth (signup/login/logout/getCurrentUser)
- `lib/types.ts` — Shared TypeScript types (Project, VoiceEntry, etc.)
- `lib/projectStore.ts` — Per-project localStorage CRUD
- `lib/voiceStore.ts` — Global voice library localStorage CRUD (key: `lumevo_voice_library`)
- `lib/audioExtract.ts` — Client-side audio extraction from video files (Web Audio API → WAV)
- `lib/aiGeneration.ts` — Client-side functions to call the content generation API

## API Routes
- `app/api/generate/content/route.ts` — OpenAI content generation endpoint (gpt-4o-mini)
- `app/api/voice/clone/route.ts` — ElevenLabs voice clone endpoint (via Replit connectors)
- `app/api/voice/synthesize/route.ts` — ElevenLabs TTS endpoint (via Replit connectors)

## Auth System
- Simple localStorage-based auth stored under `lumevo_current_user`
- Users stored under `lumevo_users` keyed by email
- Dashboard redirects to `/login` if not authenticated
- Plans: free | creator | pro | elite

## Integrations
- **OpenAI** via Replit AI Integrations — content generation. Env vars: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **ElevenLabs** via Replit Connectors — voice cloning and TTS. OAuth connector, no raw API key.

## Brand Profile System
- Built from localStorage data (projects, generated content, uploads, voices)
- Shows: Learning Progress %, Brand Voice (dominant vibe/tone), Content Output count, Voice Identity, Media Library
- Sections: Content Themes, Audience Style, Visual Identity, Confidence Score
- Evolves as the user creates more projects and uploads more content

## Pricing Tiers
- Free ($0): basic generation, limited uploads, no learning
- Creator ($29/mo): personalized captions, early brand learning
- Pro ($79/mo): full personality training, voice cloning, multi-platform
- Elite ($199/mo): AI Video Manager, voiceover, full content system

## Running the App
```bash
npm run dev    # Development server on port 5000
```

## Port Issues
If port 5000 is stuck: `fuser -k 5000/tcp` before restarting
