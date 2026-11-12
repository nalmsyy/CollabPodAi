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
      <SheetContent className="overflow-y-auto flex flex-col justify-between bg-[#fffefa] border-l border-border">
        <div className="space-y-6">
          {/* Header */}
          <SheetHeader>
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role={project.currentUserRole} className="text-[10px]" />
              <span className="text-[10px] text-muted-foreground">•</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Diperbarui {project.updatedAt}
              </span>
            </div>
            <SheetTitle className="text-2xl font-serif font-normal text-foreground leading-snug">
              {project.name}
              <span style={{ color: "#6a7b54" }}>.</span>
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs leading-relaxed">
              {project.description}
            </SheetDescription>
          </SheetHeader>

          {/* Solid Pod Workspace Architecture Info */}
          <div className="rounded-xl border border-[#dce6ce] bg-[#edf2e4] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#53643e]">
              <Database className="w-4 h-4 shrink-0" />
              <span>Target Solid Pod Workspace</span>
            </div>
            <p className="text-[11px] text-[#4d6037] leading-relaxed">
              Workspace ini dirancang untuk tersimpan pada Pod milik Owner (
              <span className="font-semibold text-foreground">{project.ownerName}</span>).
              Anggota lain mengakses kontainer dokumen melalui autentikasi WebID
              mereka masing-masing.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-[#53643e] font-mono break-all">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{project.ownerWebId}</span>
            </div>
          </div>

          {/* Member List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 shrink-0" />
                Anggota Tim ({project.members.length})
              </h4>
              <span className="text-[10px] text-muted-foreground">
                WAC Role Enforcement
              </span>
            </div>

            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {project.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-start justify-between gap-3 p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#eef3e6] text-[#53643e] flex items-center justify-center font-medium text-[11px] border border-[#dce6ce]">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {member.name}
                      </p>
                      {member.webId && (
                        <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                          {member.webId}
                        </p>
                      )}
                    </div>
                  </div>
                  <RoleBadge role={member.role} className="text-[10px]" />
                </div>
              ))}
            </div>
          </div>

          {/* Resources Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <FileText className="w-3.5 h-3.5 shrink-0 text-[#53643e]" />
                <span>Dokumen PDF/TXT</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {project.documentCount} Berkas
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Maksimal 10 dokumen (MVP)
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#53643e]" />
                <span>Persetujuan AI</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {project.documentCount > 0 ? "Siap Diuji" : "Belum Ada"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Terikat hash dokumen
              </p>
            </div>
          </div>

          {/* Integration Status Notice */}
          <div className="p-3 rounded-xl border border-[#dce6ce] bg-[#f8faf4] text-[11px] text-[#53643e] flex gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold text-foreground">Status Tahap:</strong>{" "}
              Penyimpanan dokumen Solid Pod dan ekstraksi teks peramban sudah aktif.
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
