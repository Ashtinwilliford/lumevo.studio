# Lumevo Studio – Feature Drop 1

## What's new

### Files added / updated

```
lib/
  types.ts              ← Core data model (Project, Vibe, Tone, AudienceGoal, etc.)
  projectStore.ts       ← localStorage CRUD (swap for Supabase/Firebase later)
  aiGeneration.ts       ← Client-side generation helpers (calls /api/generate/*)

app/
  api/generate/content/
    route.ts            ← Next.js API route (mock now, Anthropic SDK ready)
  dashboard/
    page.tsx            ← Rebuilt: project grid, stats, filter tabs, delete
  project/[id]/script/
    page.tsx            ← Rebuilt: title, description, vibe/tone/goal chips, generate + output
```

---

## Step-by-step integration

### 1 — Copy files

Drop every file above into your existing Next.js project at the paths shown.

### 2 — No new dependencies needed yet

When you're ready for real AI generation:

```bash
npm install @anthropic-ai/sdk
```

Then add to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3 — Enable real generation

Open `app/api/generate/content/route.ts`, uncomment the Anthropic block at the bottom, and remove the `return NextResponse.json(mock)` line above it.

### 4 — Wire the upload page to the store

In your existing `project/[id]/upload/page.tsx`, call `patchProject` after files are picked:

```ts
import { patchProject } from "@/lib/projectStore";
import type { UploadedFile } from "@/lib/types";

patchProject(id, {
  uploadedFiles: files.map(f => ({
    name: f.name,
    type: f.type.startsWith("video") ? "video" : "image",
    size: f.size,
    url: URL.createObjectURL(f),
  })),
  thumbnail: firstImagePreviewUrl,
});
```

### 5 — Create project from the create page

In your existing `app/create/page.tsx`:

```ts
import { createAndSaveProject } from "@/lib/projectStore";

const project = createAndSaveProject({ title: "My new project" });
router.push(`/project/${project.id}`);
```

---

## Data model quick reference

```ts
interface Project {
  id: string
  title: string
  description: string
  vibe: Vibe | ""
  tone: Tone | ""
  audienceGoal: AudienceGoal | ""
  uploadedFiles: UploadedFile[]
  generated?: GeneratedContent
  status: "draft" | "generating" | "ready"
  createdAt: string
  updatedAt: string
  thumbnail?: string
}
```

---

## What's next

| Feature | File to build |
|---|---|
| Voice cloning settings | app/project/[id]/voice/page.tsx |
| Brand style / color palette | app/project/[id]/brand/page.tsx |
| Export / publish queue | app/project/[id]/export/page.tsx |
| Video auto-generation | app/api/generate/video/route.ts |
| User auth + cloud storage | lib/auth.ts + Supabase |
