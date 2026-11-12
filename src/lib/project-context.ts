import type { ProjectDocument } from "../types/document.ts";
import type {
  ChatMessage,
  SourceReference,
  WorkspaceData,
} from "../types/workspace.ts";
import type { ScoredChunk } from "./retrieval.ts";

/** Context is project-scoped by the caller's repository. Never use a global chat history. */
export function buildProjectContexts(options: {
  question: string;
  threadId: string;
  data: WorkspaceData;
  documents: ProjectDocument[];
  chunks: ScoredChunk[];
}): SourceReference[] {
  const { data, documents, threadId } = options;
  const approved = new Map(
    documents.filter((d) => d.aiApproved).map((d) => [d.id, d.sha256]),
  );
  const decisionsById = new Map(data.decisions.map((d) => [d.id, d]));
  const messagesById = new Map(data.messages.map((m) => [m.id, m]));
  const activeThreads = new Map(
    data.threads
      .filter((t) => !t.archived && t.includeInContext)
      .map((t) => [t.id, t]),
  );
  const validDependency = (
    dependency: NonNullable<SourceReference["dependencies"]>[number],
  ) => {
    if (dependency.kind === "decision") {
      const decision = decisionsById.get(dependency.id);
      return !!decision?.active && decision.updatedAt === dependency.updatedAt;
    }
    const message = messagesById.get(dependency.id);
    return (
      !!message &&
      message.updatedAt === dependency.updatedAt &&
      activeThreads.has(message.threadId)
    );
  };
  const validSources = (sources: SourceReference[]) =>
    sources.every(
      (source) =>
        (source.kind !== "document" ||
          (source.documentId &&
            source.documentHash &&
            approved.get(source.documentId) === source.documentHash)) &&
        (source.evidence ?? []).every(
          (e) => approved.get(e.documentId) === e.documentHash,
        ) &&
        (source.dependencies ?? []).every(validDependency) &&
        (source.kind === "document" ||
          !source.updatedAt ||
          validDependency({
            kind: source.kind,
            id: source.id,
            updatedAt: source.updatedAt,
          })),
    );
  const evidence = (sources: SourceReference[]) =>
    sources.flatMap((source) => [
      ...(source.kind === "document" && source.documentId && source.documentHash
        ? [{ documentId: source.documentId, documentHash: source.documentHash }]
        : []),
      ...(source.evidence ?? []),
    ]);
  const dependencies = (sources: SourceReference[]) =>
    sources.flatMap((source) => [
      ...(source.kind !== "document" && source.updatedAt
        ? [{ kind: source.kind, id: source.id, updatedAt: source.updatedAt }]
        : []),
      ...(source.dependencies ?? []),
    ]);
  const terms = [
    ...new Set(
      options.question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [],
    ),
  ];
  const score = (text: string) =>
    terms.reduce(
      (sum, term) => sum + (text.toLowerCase().includes(term) ? 1 : 0),
      0,
    );
  const docSources: SourceReference[] = options.chunks
    .filter((chunk) => approved.has(chunk.documentId))
    .slice(0, 4)
    .map((chunk) => ({
      id: chunk.id,
      kind: "document",
      title: chunk.documentName,
      text: chunk.text,
      documentId: chunk.documentId,
      documentHash: approved.get(chunk.documentId),
      fileUrl: chunk.fileUrl,
      pageNumbers: chunk.pageNumbers,
    }));
  const decisions: SourceReference[] = data.decisions
    .filter((d) => d.active && validSources(d.sources))
    .sort(
      (a, b) =>
        score(b.title + b.content) - score(a.title + a.content) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      kind: "decision",
      title: d.title,
      text: d.content.slice(0, 2500),
      threadId: d.threadId,
      messageId: d.messageId,
      updatedAt: d.updatedAt,
      pageNumbers: [],
      evidence: evidence(d.sources),
      dependencies: dependencies(d.sources),
    }));
  const eligible = (m: ChatMessage) =>
    !m.demoReply &&
    validSources(m.sources) &&
    (m.role === "user" || m.sources.length > 0);
  const toSource = (m: ChatMessage): SourceReference => ({
    id: m.id,
    kind: "conversation",
    title: `${data.threads.find((t) => t.id === m.threadId)?.title ?? "Percakapan"} · ${m.role === "assistant" ? "jawaban AI, belum keputusan" : "pesan anggota"}`,
    text: m.content.slice(0, 1800),
    threadId: m.threadId,
    messageId: m.id,
    updatedAt: m.updatedAt,
    pageNumbers: [],
    evidence: evidence(m.sources),
    dependencies: dependencies(m.sources),
  });
  const current = data.messages
    .filter((m) => m.threadId === threadId && eligible(m))
    .slice(-3)
    .map(toSource);
  const others = data.messages
    .filter(
      (m) =>
        m.threadId !== threadId &&
        activeThreads.has(m.threadId) &&
        eligible(m) &&
        score(m.content) > 0,
    )
    .sort(
      (a, b) =>
        score(b.content) - score(a.content) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 3)
    .map(toSource);
  // Decision context and continuity remain available even for short follow-up questions.
  const result: SourceReference[] = [];
  let remaining = 23000;
  for (const source of [
    ...docSources,
    ...decisions,
    ...current,
    ...others,
  ].slice(0, 12)) {
    const text = source.text.slice(0, Math.min(6000, remaining));
    if (!text.trim()) continue;
    result.push({ ...source, text });
    remaining -= text.length;
  }
  return result;
}
