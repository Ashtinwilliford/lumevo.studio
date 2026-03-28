# Lumevo Studio

## Overview
An AI-powered creator platform. Users sign up, upload content, generate AI-written captions/hooks/scripts, and build a Brand Profile that trains on their content over time. The system learns the user's voice and creates content in their style.

**Core tagline**: "You Upload. Lumevo Learns. We Create."

## Architecture
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: PostgreSQL (Replit built-in) via `pg` library
- **Auth**: JWT sessions in HTTP-only cookies via `jose` + `bcryptjs`
- **Styling**: Inline CSS (per-page style tags) + globals.css — pastel yellow (#F8F8A6) + vibrant red (#FF2D2D) brand
- **Fonts**: Fredoka One (logo/display), Syne (headings), DM Sans (body)
- **Package Manager**: npm
- **Port**: 5000 (configured for Replit)
- **AI**: OpenAI GPT-4o via `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **Voice**: ElevenLabs via Replit connectors-sdk OAuth

## Design System
- **Background**: `#F8F8A6` (soft lemon yellow)
- **Accent**: `#FF2D2D` (vibrant red)
- **Surface**: `#FFFFFF`
- **Muted**: `#7c7660`
- **Logo font**: Fredoka One (bubbly/bold)
- **Heading font**: Syne (weight 700/800)
- **Body font**: DM Sans

## Database Tables
- `users` — accounts with bcrypt-hashed passwords, subscription_tier
- `brand_profiles` — living AI profile per user (tone, personality, audience, pacing, confidence)
- `uploads` — all user-uploaded files, captions, scripts, text
- `projects` — content generation and video projects
- `generated_contents` — all AI-generated text outputs
- `voiceovers` — ElevenLabs voiceover jobs
- `render_jobs` — video render pipeline tracking
- `saved_outputs` — finalized deliverables

## Key Files
- `lib/db.ts` — PostgreSQL connection pool
- `lib/session.ts` — JWT session management (create/get/delete)
- `app/api/auth/signup/route.ts` — User registration
- `app/api/auth/login/route.ts` — User login
- `app/api/auth/logout/route.ts` — Session logout
- `app/api/me/route.ts` — Get current user
- `app/api/uploads/route.ts` — File/text upload management
- `app/api/projects/route.ts` — Project CRUD
- `app/api/projects/[id]/generate-content/route.ts` — OpenAI content generation
- `app/api/brand-profile/route.ts` — Brand profile fetch
- `app/api/brand-profile/refresh/route.ts` — Recalculate brand profile
- `app/api/voice/clone/route.ts` — ElevenLabs voice cloning

## Pages
- `app/page.tsx` — Landing page (hero, features, pricing, CTA)
- `app/login/page.tsx` — Login (API-based, JWT cookie)
- `app/signup/page.tsx` — Signup (API-based, creates DB user + brand profile)
- `app/pricing/page.tsx` — Standalone pricing page (4 tiers)
- `app/dashboard/page.tsx` — Full 9-section dashboard app shell:
  - Overview: stats, learning progress, quick actions, recent projects
  - Uploads: file upload + text/caption library
  - Create Content: AI generation (caption/hook/script/post/ideas)
  - Create Video: video pipeline with status steps
  - Brand Profile: living AI profile with tone/personality/audience
  - Projects: full history with filters
  - Analytics: placeholder for future analytics
  - Billing: 4-tier subscription display
  - Settings: account management + logout

## Subscription Tiers
- **Free**: 5 uploads, 10 generations, basic brand learning
- **Creator** ($29/mo): 50 uploads, 100 generations, full brand learning
- **Pro** ($79/mo): unlimited uploads/generations, multi-platform, advanced planning
- **Elite** ($149/mo): everything + AI video creation, ElevenLabs voiceover

## Implementation Notes
- Video rendering is a pipeline UI (UI complete, actual render requires FFmpeg integration)
- Brand profile is computed from upload_count + generation_count, refreshable on demand
- Auth cookie: `lumevo_session` (HTTP-only, 7-day expiry)
- All dashboard API calls are authenticated via cookie session
