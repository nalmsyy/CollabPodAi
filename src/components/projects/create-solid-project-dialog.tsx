"use client";

import * as React from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
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
import { getSolidSessionAuth } from "@/lib/solid-session";
import {
  SolidPodProjectRepository,
  createProjectId,
  describeSolidProjectError,
  normalizePodUrl,
} from "@/lib/solid-project-repository";
import { Project } from "@/types/project";

interface CreateSolidProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pod tujuan yang sedang dipilih pengguna. */
  podUrl: string;
  onCreated: (project: Project) => void;
}

export function CreateSolidProjectDialog({
  open,
  onOpenChange,
  podUrl,
  onCreated,
}: CreateSolidProjectDialogProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  // ID stabil: percobaan ulang memakai ID yang sama sehingga tidak membuat duplikat.
  const [projectId, setProjectId] = React.useState(createProjectId);
  const [submitting, setSubmitting] = React.useState(false);
  const [failure, setFailure] = React.useState<{
    title: string;
    message: string;
  } | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  const targetPodUrl = normalizePodUrl(podUrl);
  const targetMetadataPath = `collabpod/projects/${projectId}/config/project.ttl`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldError("Nama proyek wajib diisi.");
      return;
    }
    if (trimmedName.length < 3) {
      setFieldError("Nama proyek minimal 3 karakter.");
      return;
    }

    setFieldError(null);
    setFailure(null);
    setSubmitting(true);

    try {
      const auth = await getSolidSessionAuth();
      const repository = new SolidPodProjectRepository({
        podUrl,
        webId: auth.webId,
        fetch: auth.fetch,
        idFactory: () => projectId,
      });

      const project = await repository.createProject({
        projectId,
        name: trimmedName,
        description: description.trim(),
      });

      onCreated(project);
      setName("");
      setDescription("");
      setProjectId(createProjectId());
      onOpenChange(false);
    } catch (error) {
      const described = describeSolidProjectError(error);
      setFailure({ title: described.stepLabel, message: described.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setFailure(null);
          setFieldError(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Buat Proyek di Pod</DialogTitle>
          <DialogDescription>
            Workspace proyek dibuat privat di Pod yang Anda pilih. Hanya WebID
            Anda yang memiliki izin baca, tulis, dan kontrol.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label
              htmlFor="solid-project-name"
              className="text-xs font-semibold text-foreground"
            >
              Nama Proyek <span className="text-rose-400">*</span>
            </label>
            <Input
              id="solid-project-name"
              placeholder="Contoh: Uji Penyimpanan Pod"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (fieldError) setFieldError(null);
              }}
              error={!!fieldError}
              autoFocus
              disabled={submitting}
            />
            {fieldError && (
              <p
                id="solid-project-name-error"
                role="alert"
                className="text-xs text-rose-300 flex items-center gap-1 mt-1 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="solid-project-description"
              className="text-xs font-semibold text-foreground"
            >
              Deskripsi Singkat (Opsional)
            </label>
            <Textarea
              id="solid-project-description"
              placeholder="Tuliskan tujuan penelitian atau tugas kelompok…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-[11px] leading-relaxed">
            <span className="text-xs font-semibold text-foreground block">
              Pod tujuan
            </span>
            <code className="mt-1 block font-mono text-[11px] break-all text-primary">
              {targetPodUrl}
            </code>
            <span className="mt-2 block text-muted-foreground">
              Metadata disimpan di:
            </span>
            <code className="mt-0.5 block font-mono text-[11px] break-all text-muted-foreground">
              {targetMetadataPath}
            </code>
          </div>

          {failure && (
            <div
              role="alert"
              className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-[11px] text-rose-100 leading-relaxed"
            >
              <span className="flex items-center gap-1.5 font-semibold text-rose-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {failure.title}
              </span>
              <span className="mt-1 block break-words">{failure.message}</span>
              <span className="mt-1.5 block text-rose-200/80">
                Tekan &ldquo;Simpan ke Pod&rdquo; lagi untuk melanjutkan proyek
                yang sama tanpa membuat duplikat.
              </span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {submitting ? "Menyimpan…" : "Simpan ke Pod"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
