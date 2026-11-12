import { INITIAL_DEMO_PROJECTS } from "@/data/demo-projects";
import { DEMO_WEB_ID, demoProject } from "@/lib/demo-workspace";
import type { CreateProjectInput, Project } from "@/types/project";

export interface IProjectRepository {
  listProjects(): Promise<Project[]>;
  createProject(input: CreateProjectInput): Promise<Project>;
}
const KEY = "collabpod:demo:projects:v2";
/** Demo persists only in this browser. Solid projects use the Pod repository. */
export class DemoProjectRepository implements IProjectRepository {
  async listProjects(): Promise<Project[]> {
    const raw = localStorage.getItem(KEY);
    const projects: Project[] = raw
      ? JSON.parse(raw)
      : structuredClone(INITIAL_DEMO_PROJECTS);
    return projects.map((project) => {
      const saved = localStorage.getItem(
        `collabpod:demo:project:${project.id}`,
      );
      const docs = localStorage.getItem(
        `collabpod:demo:documents:v2:${project.id}`,
      );
      return {
        ...(saved ? JSON.parse(saved) : project),
        documentCount: docs ? JSON.parse(docs).length : project.documentCount,
      };
    });
  }
  async createProject(input: CreateProjectInput): Promise<Project> {
    const project = {
      ...demoProject(`proj-demo-${crypto.randomUUID()}`, input.name.trim()),
      description: input.description.trim(),
      currentUserRole: input.role ?? "Owner",
      documentCount: 0,
      members: [
        {
          id: "demo-user",
          name: "Yuhu",
          webId: DEMO_WEB_ID,
          role: input.role ?? "Owner",
        },
      ],
      updatedAt: "Baru saja",
    };
    localStorage.setItem(
      KEY,
      JSON.stringify([project, ...(await this.listProjects())]),
    );
    return project;
  }
}
export const demoProjectRepository = new DemoProjectRepository();
