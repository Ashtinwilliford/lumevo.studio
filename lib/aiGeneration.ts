import type { Project, ContentBlock } from "./types";

export interface GenerationResult {
  captions: string[];
  titleIdeas: string[];
  contentStructure: ContentBlock[];
}

export async function generateContent(project: Project): Promise<GenerationResult> {
  const res = await fetch("/api/generate/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: project.title,
      description: project.description,
      vibe: project.vibe,
      tone: project.tone,
      audienceGoal: project.audienceGoal,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Generation failed: ${err}`);
  }

  return res.json() as Promise<GenerationResult>;
}

export async function generateCaptions(project: Project): Promise<string[]> {
  const result = await generateContent(project);
  return result.captions;
}

export async function generateTitleIdeas(project: Project): Promise<string[]> {
  const result = await generateContent(project);
  return result.titleIdeas;
}

export async function generateContentStructure(project: Project): Promise<ContentBlock[]> {
  const result = await generateContent(project);
  return result.contentStructure;
}
