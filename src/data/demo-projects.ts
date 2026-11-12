import { demoProject, DEMO_PROJECT_ID } from "@/lib/demo-workspace";
import type { Project } from "@/types/project";

export const INITIAL_DEMO_PROJECTS: Project[] = [demoProject(DEMO_PROJECT_ID)];
