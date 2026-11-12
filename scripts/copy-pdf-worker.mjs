// Menyalin worker pdf.js ke folder public agar bisa dimuat peramban sebagai
// berkas statis. Bundler (Turbopack/webpack) tidak selalu menyajikan worker
// internal pdfjs-dist, sehingga `new URL(..., import.meta.url)` bisa 404.
import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  projectRoot,
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
);
const destination = resolve(projectRoot, "public/pdf.worker.min.mjs");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(source))) {
  console.warn(
    "[copy-pdf-worker] pdfjs-dist belum terpasang; worker dilewati."
  );
  process.exit(0);
}

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs diperbarui.");
