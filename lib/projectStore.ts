import { Project, createProject } from "./types";

const STORAGE_KEY = "lumevo_projects";

export function getAllProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

export function getProject(id: string): Project | null {
  return getAllProjects().find((p) => p.id === id) ?? null;
}

export function saveProject(project: Project): Project {
  const projects = getAllProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  const updated = { ...project, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    projects[idx] = updated;
  } else {
    projects.unshift(updated);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  return updated;
}

export function createAndSaveProject(partial: Partial<Project> = {}): Project {
  const project = createProject(partial);
  return saveProject(project);
}

export function deleteProject(id: string): void {
  const projects = getAllProjects().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function patchProject(id: string, patch: Partial<Project>): Project | null {
  const existing = getProject(id);
  if (!existing) return null;
  return saveProject({ ...existing, ...patch });
}
