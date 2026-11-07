"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/badge";
import { Project } from "@/types/project";
import {
  Users,
  FileText,
  Database,
  Lock,
  Info,
  Sparkles,
} from "lucide-react";

interface ProjectSummarySheetProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSummarySheet({
  project,
  open,
  onOpenChange,
}: ProjectSummarySheetProps) {
  if (!project) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <SheetHeader>
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role={project.currentUserRole} />
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground font-medium">
                Diperbarui {project.updatedAt}
              </span>
            </div>
            <SheetTitle className="text-xl font-bold text-foreground">
              {project.name}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-sm">
              {project.description}
            </SheetDescription>
          </SheetHeader>

          {/* Solid Pod Workspace Architecture Info */}
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Database className="w-4 h-4 text-primary" />
              <span>Target Solid Pod Workspace</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Workspace ini dirancang untuk tersimpan pada Pod milik Owner (
              <span className="font-semibold text-foreground">{project.ownerName}</span>).
              Anggota lain mengakses kontainer dokumen melalui autentikasi WebID
              mereka masing-masing.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-primary/90 font-mono break-all">
              <Lock className="w-3 h-3 shrink-0" />
              <span className="truncate">{project.ownerWebId}</span>
            </div>
          </div>

          {/* Member List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Anggota Tim ({project.members.length})
              </h4>
              <span className="text-[11px] text-muted-foreground/80">
                WAC Role Enforcement
              </span>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border bg-background/40">
              {project.members.map((member) => (
                <div
                  key={member.id}
                  className="p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-secondary text-foreground flex items-center justify-center font-medium text-xs">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {member.name}
                      </p>
                      {member.webId && (
                        <p className="text-[10px] text-muted-foreground/80 font-mono truncate max-w-[180px]">
                          {member.webId}
                        </p>
                      )}
                    </div>
                  </div>
                  <RoleBadge role={member.role} />
                </div>
              ))}
            </div>
          </div>

          {/* Resources Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg border border-border bg-background/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <span>Dokumen PDF/TXT</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {project.documentCount} Berkas
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                Maksimal 10 dokumen (MVP)
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-background/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Persetujuan AI</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {project.documentCount > 0 ? "Siap Diuji" : "Belum Ada"}
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                Terikat hash dokumen
              </p>
            </div>
          </div>

          {/* Integration Status Notice */}
          <div className="p-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-xs text-amber-200 flex gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold text-amber-100">Status Tahap 1:</strong>{" "}
              Halaman ini merupakan pratinjau arsitektur proyek. Integrasi upload
              dokumen, manajemen ACL Pod, dan tanya-jawab AI akan diaktifkan secara
              bertahap.
            </div>
          </div>
        </div>

        <SheetFooter className="mt-8">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Tutup Pratinjau
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
