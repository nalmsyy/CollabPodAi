"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CreateProjectInput, ProjectRole } from "@/types/project";
import { AlertCircle, Plus } from "lucide-react";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateProjectInput) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateProjectDialogProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [role, setRole] = React.useState<ProjectRole>("Owner");
  const [error, setError] = React.useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setRole("Owner");
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Nama proyek wajib diisi.");
      return;
    }

    if (name.trim().length < 3) {
      setError("Nama proyek minimal 3 karakter.");
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      role,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Buat Proyek Demo Baru</DialogTitle>
          <DialogDescription>
            Simulasikan pembuatan workspace riset mahasiswa. Data proyek ini akan
            disimpan pada memori peramban lokal untuk pengujian tampilan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Project Name Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="project-name"
              className="text-xs font-semibold text-foreground"
            >
              Nama Proyek <span className="text-rose-400">*</span>
            </label>
            <Input
              id="project-name"
              placeholder="Contoh: Evaluasi Kinerja Energi Surya Kampus"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              error={!!error}
              autoFocus
            />
            {error && (
              <p
                id="name-error"
                className="text-xs text-rose-300 flex items-center gap-1 mt-1 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="project-description"
              className="text-xs font-semibold text-foreground"
            >
              Deskripsi Singkat (Opsional)
            </label>
            <Textarea
              id="project-description"
              placeholder="Tuliskan tujuan penelitian atau tugas kelompok..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* User Role Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Peran Anda pada Proyek Demo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["Owner", "Editor", "Viewer"] as ProjectRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                    role === r
                      ? "border-primary bg-primary/15 text-foreground font-semibold ring-1 ring-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <span>{r}</span>
                  <span className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    {r === "Owner"
                      ? "Pemilik Pod"
                      : r === "Editor"
                      ? "Kelola konten"
                      : "Hanya baca"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-amber-500/10 p-2.5 border border-amber-400/30 text-[11px] text-amber-200 leading-normal">
            <strong className="font-semibold text-amber-100">Catatan Demo:</strong>{" "}
            Proyek baru akan ditambahkan ke state lokal saat ini dan akan tereset
            saat halaman dimuat ulang.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              <Plus className="w-4 h-4 mr-1" />
              Simpan Proyek Demo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
