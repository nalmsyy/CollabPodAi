export type ProjectRole = "Owner" | "Editor" | "Viewer";

export interface ProjectMember {
  id: string;
  name: string;
  role: ProjectRole;
  webId?: string;
  email?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  currentUserRole: ProjectRole;
  ownerName: string;
  ownerWebId: string;
  members: ProjectMember[];
  updatedAt: string;
  documentCount: number;
  isDemo: boolean;
  /** URL metadata proyek di Pod (hanya untuk proyek Solid). */
  metadataUrl?: string;
  /** Pod asal proyek (hanya untuk proyek Solid). */
  podUrl?: string;
  /** URL kontainer workspace proyek di Pod: {podUrl}/collabpod/projects/{projectId}/ */
  workspaceUrl?: string;
}

export type ProjectFilterType = "all" | "mine" | "shared";

export interface CreateProjectInput {
  name: string;
  description: string;
  role?: ProjectRole;
  /** ID stabil agar percobaan ulang melanjutkan proyek yang sama. */
  projectId?: string;
}

