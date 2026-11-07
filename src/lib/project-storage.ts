import { INITIAL_DEMO_PROJECTS } from "@/data/demo-projects";
import { CreateProjectInput, Project } from "@/types/project";

/**
 * Interface abstraksi repositori proyek.
 * Pada tahap demo lokal, implementasi menggunakan data memori.
 * Pada tahap integrasi Solid Protocol, implementasi ini dapat diganti
 * dengan pemanggilan LDP (Linked Data Platform) / RDF Turtle ke Solid Pod.
 */
export interface IProjectRepository {
  listProjects(): Promise<Project[]>;
  createProject(input: CreateProjectInput): Promise<Project>;
}

export class DemoProjectRepository implements IProjectRepository {
  private projects: Project[];

  constructor(initialData: Project[] = INITIAL_DEMO_PROJECTS) {
    // Clone array agar tidak mengubah referensi konstan langsung
    this.projects = [...initialData];
  }

  async listProjects(): Promise<Project[]> {
    return [...this.projects];
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const newProject: Project = {
      id: `proj-demo-${Date.now()}`,
      name: input.name.trim(),
      description: input.description.trim() || "Tidak ada deskripsi proyek.",
      currentUserRole: input.role || "Owner",
      ownerName: "Andi (Pengguna Demo)",
      ownerWebId: "https://andi.solidcommunity.net/profile/card#me",
      members: [
        {
          id: `mem-${Date.now()}-1`,
          name: "Andi (Pengguna Demo)",
          role: input.role || "Owner",
          webId: "https://andi.solidcommunity.net/profile/card#me",
        },
      ],
      updatedAt: "Baru saja",
      documentCount: 0,
      isDemo: true,
    };

    this.projects = [newProject, ...this.projects];
    return newProject;
  }
}

// Instance default untuk demo
export const demoProjectRepository = new DemoProjectRepository();

