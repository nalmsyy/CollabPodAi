import type { Project } from "../types/project.ts";
import type { WorkspaceData } from "../types/workspace.ts";
import type { ProjectDocument, DocumentListResult } from "../types/document.ts";
import {
  SolidDocumentRepository,
  computeFileSha256,
  validateDocumentFile,
  createDocumentId,
} from "./solid-document-repository.ts";

export const DEMO_PROJECT_ID = "proj-kualitas-air";
export const DEMO_WEB_ID = "https://demo.example/yuhu/profile/card#me";
const time = "2026-11-11T08:00:00.000Z";
const base = {
  createdAt: time,
  updatedAt: time,
  createdBy: DEMO_WEB_ID,
  etag: time,
};
export function demoProject(id: string, name = "Riset kualitas air"): Project {
  return {
    id,
    name,
    description: "Beda bagian, satu pemahaman. Bangun penelitian bersama.",
    currentUserRole: "Owner",
    ownerName: "Yuhu",
    ownerWebId: DEMO_WEB_ID,
    updatedAt: "11 Nov 2026",
    documentCount: 6,
    isDemo: true,
    members: [
      { id: "yuhu", name: "Yuhu", webId: DEMO_WEB_ID, role: "Owner" },
      {
        id: "nadia",
        name: "Nadia Putri",
        webId: "https://demo.example/nadia/profile/card#me",
        role: "Editor",
      },
      {
        id: "raka",
        name: "Raka Pratama",
        webId: "https://demo.example/raka/profile/card#me",
        role: "Editor",
      },
    ],
  };
}
export function demoWorkspaceSeed(projectId = DEMO_PROJECT_ID): WorkspaceData {
  if (projectId !== DEMO_PROJECT_ID)
    return { threads: [], messages: [], decisions: [], tasks: [] };
  return {
    threads: [
      {
        ...base,
        id: "background",
        title: "Latar belakang",
        description: "Merangkai masalah, konteks, dan arah penelitian.",
        includeInContext: true,
        archived: false,
      },
      {
        ...base,
        id: "methods",
        title: "Metodologi",
        description: "Menyelaraskan rancangan dan langkah penelitian.",
        createdBy: "https://demo.example/nadia/profile/card#me",
        includeInContext: true,
        archived: false,
      },
      {
        ...base,
        id: "results",
        title: "Hasil & pembahasan",
        description: "Menghubungkan temuan dengan pertanyaan penelitian.",
        createdBy: "https://demo.example/raka/profile/card#me",
        includeInContext: true,
        archived: false,
      },
    ],
    messages: [
      {
        ...base,
        id: "background-1",
        threadId: "background",
        role: "user",
        content:
          "Fokus penelitian kita adalah kualitas air sungai. Latar belakang perlu menjelaskan hubungan aktivitas di sekitar sungai dengan parameter pH, suhu, dan kekeruhan.",
        sources: [],
      },
      {
        ...base,
        id: "methods-1",
        createdBy: "https://demo.example/nadia/profile/card#me",
        threadId: "methods",
        role: "user",
        content:
          "Metodologi perlu mengikuti fokus latar belakang: mengukur pH, suhu, dan kekeruhan. Lokasi serta jumlah titik sampling masih harus disepakati bersama.",
        sources: [],
      },
      {
        ...base,
        id: "results-1",
        createdBy: "https://demo.example/raka/profile/card#me",
        threadId: "results",
        role: "user",
        content:
          "Bagian hasil akan memakai tabel parameter pH, suhu, dan kekeruhan. Belum ada hasil pengukuran sehingga kita tidak boleh menuliskan angka temuan.",
        sources: [],
      },
    ],
    decisions: [
      {
        ...base,
        id: "scope",
        title: "Fokus penelitian",
        content:
          "Penelitian membahas kualitas air sungai dengan parameter pH, suhu, dan kekeruhan. Seluruh bagian naskah mengikuti ruang lingkup ini.",
        active: true,
        sources: [],
        threadId: "background",
        messageId: "background-1",
      },
      {
        ...base,
        id: "sampling",
        title: "Rencana pengambilan data",
        content:
          "Lokasi dan jumlah titik sampling harus disepakati sebelum pengambilan data. Jangan menyatakan hasil pengukuran sebelum data tersedia.",
        active: true,
        sources: [],
      },
    ],
    tasks: [
      {
        ...base,
        id: "task-1",
        title: "Lengkapi matriks tinjauan literatur",
        description: "",
        assignee: DEMO_WEB_ID,
        status: "doing",
      },
      {
        ...base,
        id: "task-2",
        title: "Sepakati titik pengambilan sampel",
        description: "",
        assignee: "https://demo.example/nadia/profile/card#me",
        status: "review",
      },
      {
        ...base,
        id: "task-3",
        title: "Siapkan struktur tabel hasil",
        description: "",
        assignee: "https://demo.example/raka/profile/card#me",
        status: "todo",
      },
      {
        ...base,
        id: "task-4",
        title: "Susun tujuan penelitian",
        description: "",
        assignee: DEMO_WEB_ID,
        status: "done",
      },
      {
        ...base,
        id: "task-5",
        title: "Unggah proposal awal",
        description: "",
        assignee: DEMO_WEB_ID,
        status: "done",
      },
    ],
  };
}
const SAMPLE_DOCS = [
  [
    "Proposal penelitian.txt",
    "Penelitian ini membahas kualitas air sungai. Tujuan penelitian adalah mendeskripsikan parameter pH, suhu, dan kekeruhan air. Penelitian belum menghasilkan data lapangan. Lokasi dan jumlah titik sampling akan ditentukan tim. Metode yang direncanakan adalah observasi lapangan dan pengukuran langsung.",
  ],
  [
    "Rancangan pengambilan sampel.txt",
    "Pengambilan sampel air membutuhkan kesepakatan lokasi, waktu, dan jumlah titik pengamatan. Catat kondisi cuaca, aktivitas sekitar sungai, suhu, pH, dan kekeruhan pada setiap pengukuran. Kalibrasi alat sebelum penggunaan dan dokumentasikan prosedur pengukuran.",
  ],
  [
    "Peta literatur awal.txt",
    "Matriks literatur memuat penulis, tahun, tujuan, metode, parameter kualitas air, dan keterbatasan penelitian. Dokumen ini adalah ilustrasi struktur kerja, bukan kumpulan temuan ilmiah. Tim perlu mengunggah artikel asli sebelum mengutip klaim penelitian terdahulu.",
  ],
  [
    "Panduan penulisan kelompok.txt",
    "Latar belakang, metodologi, dan pembahasan memakai istilah serta fokus penelitian yang sama. Klaim harus memiliki rujukan. Jika chat berbeda menghasilkan saran yang bertentangan, diskusikan dan simpan keputusan bersama. Jangan menganggap usulan AI sebagai fakta.",
  ],
  [
    "Catatan observasi awal.txt",
    "Catatan awal ini belum ditinjau Owner dan belum boleh digunakan sebagai konteks AI.",
  ],
  [
    "Rencana pengolahan data.txt",
    "Rencana analisis belum disepakati. Dokumen ini menunggu tinjauan Owner.",
  ],
];
interface DemoFile {
  document: ProjectDocument;
  bytes: string;
}
/** Implements the same document contract, but all mutations stay in this browser's demo namespace. */
export class DemoDocumentRepository extends SolidDocumentRepository {
  private readonly key: string;
  private readonly seedExamples: boolean;
  constructor(projectId: string) {
    super({
      workspaceUrl: `https://demo.example/projects/${projectId}/`,
      ownerWebId: DEMO_WEB_ID,
      webId: DEMO_WEB_ID,
      currentUserRole: "Owner",
      fetch,
    });
    this.key = `collabpod:demo:documents:v2:${projectId}`;
    this.seedExamples = projectId === DEMO_PROJECT_ID;
  }
  private async files(): Promise<DemoFile[]> {
    const raw = localStorage.getItem(this.key);
    if (raw) return JSON.parse(raw);
    const files = await Promise.all(
      (this.seedExamples ? SAMPLE_DOCS : []).map(async ([name, text], i) => {
        const bytes = new TextEncoder().encode(text).buffer;
        const id = `demo-doc-${i + 1}`;
        return {
          document: {
            id,
            name,
            fileUrl: this.fileUrlFor(id, "text/plain"),
            metadataUrl: this.metadataUrlFor(id),
            mimeType: "text/plain" as const,
            sizeBytes: bytes.byteLength,
            uploadedAt: time,
            uploaderWebId: DEMO_WEB_ID,
            sha256: await computeFileSha256(bytes),
            aiApproved: i < 4,
            isComplete: true as const,
          },
          bytes: btoa(String.fromCharCode(...new Uint8Array(bytes))),
        };
      }),
    );
    localStorage.setItem(this.key, JSON.stringify(files));
    return files;
  }
  override async listDocuments(): Promise<DocumentListResult> {
    return {
      documents: (await this.files()).map((f) => f.document),
      incompleteDocuments: [],
    };
  }
  override async fetchDocumentBytes(
    document: ProjectDocument,
  ): Promise<ArrayBuffer> {
    const file = (await this.files()).find(
      (f) => f.document.id === document.id,
    );
    if (!file) throw new Error("Dokumen demo tidak ditemukan.");
    return Uint8Array.from(atob(file.bytes), (c) => c.charCodeAt(0)).buffer;
  }
  override async fetchApprovedDocumentBytes(
    document: ProjectDocument,
  ): Promise<ArrayBuffer> {
    const file = (await this.files()).find(
      (f) => f.document.id === document.id,
    );
    if (!file?.document.aiApproved) throw new Error("Dokumen belum disetujui.");
    const bytes = await this.fetchDocumentBytes(document);
    if ((await computeFileSha256(bytes)) !== document.sha256)
      throw new Error("Versi dokumen berubah.");
    return bytes;
  }
  override async uploadDocument(
    file: {
      name: string;
      size: number;
      type?: string;
      arrayBuffer: () => Promise<ArrayBuffer>;
    },
    options?: { documentId?: string },
  ): Promise<ProjectDocument> {
    const files = await this.files();
    const validation = validateDocumentFile(file, files.length);
    if (!validation.valid) throw new Error(validation.error);
    const data = await file.arrayBuffer();
    const id = options?.documentId ?? createDocumentId();
    const mimeType = file.name.toLowerCase().endsWith(".pdf")
      ? ("application/pdf" as const)
      : ("text/plain" as const);
    const document: ProjectDocument = {
      id,
      name: file.name,
      fileUrl: this.fileUrlFor(id, mimeType),
      metadataUrl: this.metadataUrlFor(id),
      mimeType,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      uploaderWebId: DEMO_WEB_ID,
      sha256: await computeFileSha256(data),
      aiApproved: false,
      isComplete: true,
    };
    let binary = "";
    const bytes = new Uint8Array(data);
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    localStorage.setItem(
      this.key,
      JSON.stringify([
        ...files.filter((f) => f.document.id !== id),
        { document, bytes: btoa(binary) },
      ]),
    );
    return document;
  }
  override async setAiApproved(
    document: ProjectDocument,
    approved: boolean,
  ): Promise<void> {
    const files = await this.files();
    const file = files.find((f) => f.document.id === document.id);
    if (!file) throw new Error("Dokumen tidak ditemukan.");
    file.document.aiApproved = approved;
    localStorage.setItem(this.key, JSON.stringify(files));
  }
  override async deleteDocument(document: ProjectDocument): Promise<void> {
    localStorage.setItem(
      this.key,
      JSON.stringify(
        (await this.files()).filter((f) => f.document.id !== document.id),
      ),
    );
  }
  override async downloadDocument(document: ProjectDocument) {
    return {
      blob: new Blob([await this.fetchDocumentBytes(document)], {
        type: document.mimeType,
      }),
      filename: document.name,
      mimeType: document.mimeType,
    };
  }
}
