export type Vibe =
  | "hype"
  | "chill"
  | "aesthetic"
  | "educational"
  | "storytelling"
  | "motivational"
  | "funny"
  | "luxury";

export type Tone =
  | "casual"
  | "professional"
  | "playful"
  | "raw"
  | "cinematic"
  | "conversational";

export type AudienceGoal =
  | "grow_followers"
  | "drive_sales"
  | "build_community"
  | "educate"
  | "entertain"
  | "inspire";

export interface UploadedFile {
  name: string;
  type: "image" | "video";
  size: number;
  url?: string;
}

export interface GeneratedContent {
  captions?: string[];
  titleIdeas?: string[];
  contentStructure?: ContentBlock[];
  generatedAt?: string;
}

export interface ContentBlock {
  label: string;
  suggestion: string;
  duration?: string;
}

export interface VoiceEntry {
  id: string;
  elevenLabsId: string;
  name: string;
  personality: string;
  createdAt: string;
  usedInProjects: string[];
  sampleCount: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  vibe: Vibe | "";
  tone: Tone | "";
  audienceGoal: AudienceGoal | "";
  uploadedFiles: UploadedFile[];
  generated?: GeneratedContent;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "generating" | "ready";
  thumbnail?: string;
  selectedVoiceId?: string;
}

export function createProject(partial: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? crypto.randomUUID(),
    title: partial.title ?? "Untitled Project",
    description: partial.description ?? "",
    vibe: partial.vibe ?? "",
    tone: partial.tone ?? "",
    audienceGoal: partial.audienceGoal ?? "",
    uploadedFiles: partial.uploadedFiles ?? [],
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    status: partial.status ?? "draft",
    thumbnail: partial.thumbnail,
    generated: partial.generated,
    selectedVoiceId: partial.selectedVoiceId,
  };
}

export const VIBE_LABELS: Record<Vibe, string> = {
  hype: "Hype",
  chill: "Chill",
  aesthetic: "Aesthetic",
  educational: "Educational",
  storytelling: "Storytelling",
  motivational: "Motivational",
  funny: "Funny",
  luxury: "Luxury",
};

export const TONE_LABELS: Record<Tone, string> = {
  casual: "Casual",
  professional: "Professional",
  playful: "Playful",
  raw: "Raw & Real",
  cinematic: "Cinematic",
  conversational: "Conversational",
};

export const AUDIENCE_GOAL_LABELS: Record<AudienceGoal, string> = {
  grow_followers: "Grow Followers",
  drive_sales: "Drive Sales",
  build_community: "Build Community",
  educate: "Educate",
  entertain: "Entertain",
  inspire: "Inspire",
};
