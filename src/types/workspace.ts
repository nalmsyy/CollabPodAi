import type { ProjectRole } from "./project";

export type WorkspaceView =
  "overview" | "chats" | "documents" | "tasks" | "members" | "settings";
export type SourceKind = "document" | "decision" | "conversation";
export interface SourceReference {
  id: string;
  kind: SourceKind;
  title: string;
  text: string;
  documentId?: string;
  documentHash?: string;
  fileUrl?: string;
  pageNumbers: number[];
  threadId?: string;
  messageId?: string;
  updatedAt?: string;
  evidence?: { documentId: string; documentHash: string }[];
  dependencies?: {
    kind: "decision" | "conversation";
    id: string;
    updatedAt: string;
  }[];
}
export interface WorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Strong ETag from the Pod. Never serialized as application data. */
  etag?: string;
}
export interface ChatThread extends WorkspaceEntity {
  title: string;
  description: string;
  includeInContext: boolean;
  archived: boolean;
}
export interface ChatMessage extends WorkspaceEntity {
  threadId: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceReference[];
  demoReply?: boolean;
}
export interface SharedDecision extends WorkspaceEntity {
  title: string;
  content: string;
  threadId?: string;
  messageId?: string;
  sources: SourceReference[];
  active: boolean;
}
export type TaskStatus = "todo" | "doing" | "review" | "done";
export interface ProjectTask extends WorkspaceEntity {
  title: string;
  description: string;
  assignee: string;
  status: TaskStatus;
  threadId?: string;
  messageId?: string;
}
export interface WorkspaceData {
  threads: ChatThread[];
  messages: ChatMessage[];
  decisions: SharedDecision[];
  tasks: ProjectTask[];
}
export interface WorkspaceCollection {
  threads: ChatThread;
  messages: ChatMessage;
  decisions: SharedDecision;
  tasks: ProjectTask;
}
export type CollectionName = keyof WorkspaceCollection;
export interface WorkspaceRepository {
  readonly mode: "solid" | "demo";
  readonly role: ProjectRole;
  read(): Promise<WorkspaceData>;
  put<K extends CollectionName>(
    collection: K,
    item: WorkspaceCollection[K],
    create?: boolean,
  ): Promise<void>;
}
export const EMPTY_WORKSPACE: WorkspaceData = {
  threads: [],
  messages: [],
  decisions: [],
  tasks: [],
};
export function entityId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
export function entityMeta(prefix: string, webId: string): WorkspaceEntity {
  const now = new Date().toISOString();
  return {
    id: entityId(prefix),
    createdAt: now,
    updatedAt: now,
    createdBy: webId,
  };
}
