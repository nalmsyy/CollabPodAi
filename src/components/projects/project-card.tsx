"use client";

import * as React from "react";
import { Users, FileText, ArrowUpRight } from "lucide-react";
import { Project } from "@/types/project";
import { RoleBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ProjectCardProps {
  project: Project;
  onClick?: (project: Project) => void;
  /** Nomor urut kartu (01, 02, dst.) */
  index?: number;
}

export function ProjectCard({ project, onClick, index }: ProjectCardProps) {
  const router = useRouter();
  const handleClick = React.useCallback(() => {
    if (onClick) {
      onClick(project);
      return;
    }
    router.push(`/dashboard/detail/${encodeURIComponent(project.id)}`);
  }, [onClick, project, router]);

  const indexLabel = index !== undefined ? String(index + 1).padStart(2, "0") : null;

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
        "group relative text-left bg-[#fffefa] border border-[#dce6ce] rounded-lg overflow-hidden block cursor-pointer",
        "hover:-translate-y-1 hover:shadow-[0_8px_22px_rgba(54,85,34,0.07)] transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {/* Cover ilustrasi */}
      <div className="relative h-[120px] bg-[#edf2e3] flex items-center justify-center overflow-hidden">
        {/* Nomor urut */}
        {indexLabel && (
          <span className="absolute top-3 left-4 text-[11px] font-[550] text-[#6c7b5a] font-serif">
            {indexLabel}
          </span>
        )}
        {/* Ikon ArrowUpRight di kanan atas */}
        <span className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#6a7b54]">
          <ArrowUpRight className="w-4 h-4" />
        </span>
        {/* Ilustrasi sederhana - ikon dokumen bertumpuk */}
        <div className="flex flex-col items-center gap-1 opacity-30">
          <div className="w-8 h-10 border-2 border-[#6a7b54] rounded-sm relative">
            <div className="absolute top-1 left-1.5 right-1.5 h-0.5 bg-[#6a7b54] rounded" />
            <div className="absolute top-3 left-1.5 right-1.5 h-0.5 bg-[#6a7b54] rounded" />
            <div className="absolute top-5 left-1.5 right-2.5 h-0.5 bg-[#6a7b54] rounded" />
          </div>
        </div>
        {/* Category label */}
        <span className="absolute bottom-3 left-4 text-[9px] tracking-widest uppercase font-semibold text-[#6a7b54]">
          {project.currentUserRole === "Owner" ? "Workspace • Milik Saya" : "Workspace • Dibagikan"}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[15px] font-[500] text-foreground leading-snug line-clamp-1 group-hover:text-[#3f5028] transition-colors">
            {project.name}
          </h3>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {project.description && project.description !== "Tidak ada deskripsi proyek." && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-3">
            {project.description}
          </p>
        )}

        {/* Footer metadata */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#e3eada] text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {project.documentCount} dokumen
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            {project.members.length} anggota
          </span>
          <span className="ml-auto">
            <RoleBadge role={project.currentUserRole} />
          </span>
        </div>
      </div>
    </article>
  );
}
