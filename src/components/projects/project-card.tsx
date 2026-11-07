"use client";

import * as React from "react";
import { Users, Clock, FileText, ChevronRight } from "lucide-react";
import { Project } from "@/types/project";
import { RoleBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ProjectCardProps {
  project: Project;
  onClick?: (project: Project) => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const router = useRouter();
  const handleClick = React.useCallback(() => {
    // Kartu demo memakai handler pemanggil (sheet ringkasan); kartu Solid
    // membuka rute detail agar proyek yang sama terbaca lagi setelah refresh.
    if (onClick) {
      onClick(project);
      return;
    }
    router.push(`/dashboard/detail/${encodeURIComponent(project.id)}`);
  }, [onClick, project, router]);

  return (
    <article
      tabIndex={0}
      role="link"
      aria-label={`Buka detail proyek ${project.name}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 text-left transition-all duration-150",
        "hover:border-primary/50 hover:bg-accent/40 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <div>
        {/* Header: Role & Updates */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <RoleBadge role={project.currentUserRole} />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{project.updatedAt}</span>
          </div>
        </div>

        {/* Project Name */}
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {project.name}
        </h3>

        {/* Project Description */}
        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      </div>

      {/* Footer Metadata */}
      <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>{project.members.length} anggota</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>{project.documentCount} dokumen</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-primary font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          <span>Detail</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </article>
  );
}
