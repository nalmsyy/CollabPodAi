"use client";

import * as React from "react";
import { FolderSearch, FolderPlus, Plus } from "lucide-react";
import { Project } from "@/types/project";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";

interface ProjectListProps {
  projects: Project[];
  searchQuery: string;
  onClearSearch: () => void;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
}

export function ProjectList({
  projects,
  searchQuery,
  onClearSearch,
  onSelectProject,
  onCreateProject,
}: ProjectListProps) {
  // Empty state: Pencarian tidak menemukan hasil
  if (projects.length === 0 && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-muted/40">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-3">
          <FolderSearch className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">
          Proyek tidak ditemukan
        </h4>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Tidak ada workspace yang cocok dengan kata kunci &ldquo;{searchQuery}&rdquo;.
          Periksa kembali ejaan nama proyek Anda.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onClearSearch}
        >
          Hapus Filter Pencarian
        </Button>
      </div>
    );
  }

  // Empty state: Belum ada proyek
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-muted/40">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
          <FolderPlus className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">
          Belum ada proyek di daftar ini
        </h4>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Mulai dengan membuat proyek demo baru untuk mengeksplorasi antarmuka
          workspace kelompok.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={onCreateProject}
        >
          <Plus className="w-4 h-4 mr-1" />
          Buat Proyek Demo
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project, index) => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={onSelectProject}
          index={index}
        />
      ))}
    </div>
  );
}
