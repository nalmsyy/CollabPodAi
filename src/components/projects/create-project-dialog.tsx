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
      <DialogContent className="sm:max-w-[480px] p-6 bg-[#fffefa] border border-[#dce6ce] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif font-normal text-foreground">
            Buat Proyek Demo Baru
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Simulasikan pembuatan workspace riset mahasiswa. Data proyek ini akan
            disimpan pada memori peramban lokal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Project Name Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="project-name"
              className="text-xs font-semibold text-foreground"
            >
              Nama Proyek <span className="text-rose-600">*</span>
            </label>
            <Input
              id="project-name"
              placeholder="Contoh: Evaluasi Kinerja Energi Surya Kampus"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              className={error ? "border-rose-400" : ""}
            />
            {error && (
              <p
                id="name-error"
                className="text-xs text-rose-700 flex items-center gap-1 mt-1 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
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
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all select-none ${
                    role === r
                      ? "border-[#53643e] bg-[#edf2e4] text-[#4d6037] font-semibold"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
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

          <div className="rounded-xl bg-[#edf2e4] p-3 border border-[#dce6ce] text-[11px] text-[#53643e] leading-relaxed">
            <strong className="font-semibold text-[#374426]">Catatan Demo:</strong>{" "}
            Proyek baru akan ditambahkan ke state lokal saat ini dan akan tereset
            saat halaman dimuat ulang.
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Simpan Proyek Demo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
