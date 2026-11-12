import test from "node:test";
import assert from "node:assert/strict";
import {
  DocumentExtractionError,
  buildExtractedDocument,
  extractDocumentText,
  extractPlainTextFromBuffer,
  normalizeExtractedText,
} from "../src/lib/pdf-extractor.ts";

test("normalizeExtractedText merapikan spasi dan baris berlebih", () => {
  const raw = "  Judul   Dokumen \r\n\n\n\nBaris  kedua\tini  \n";
  assert.equal(normalizeExtractedText(raw), "Judul Dokumen\n\nBaris kedua ini");
});

test("extractPlainTextFromBuffer membaca TXT UTF-8 sebagai satu halaman", () => {
  const bytes = new TextEncoder().encode(
    "Paragraf pertama.\n\nParagraf kedua dengan é dan ü."
  ).buffer;

  const result = extractPlainTextFromBuffer(bytes);
  assert.equal(result.mimeType, "text/plain");
  assert.equal(result.pageCount, 1);
  assert.equal(result.hasText, true);
  assert.match(result.text, /Paragraf kedua dengan é dan ü\./);
  assert.equal(result.characterCount, result.text.length);
});

test("buildExtractedDocument memisahkan teks per halaman", () => {
  const result = buildExtractedDocument("application/pdf", [
    { pageNumber: 1, text: "Halaman satu" },
    { pageNumber: 2, text: "" },
    { pageNumber: 3, text: "Halaman tiga" },
  ]);

  assert.equal(result.pageCount, 3);
  assert.equal(result.text, "Halaman satu\n\nHalaman tiga");
  assert.equal(result.hasText, true);
});

test("format dokumen yang tidak didukung ditolak", async () => {
  await assert.rejects(
    () =>
      extractDocumentText({ mimeType: "image/png" }, async () => new ArrayBuffer(8)),
    (error) =>
      error instanceof DocumentExtractionError && error.code === "unsupported"
  );
});

test("kegagalan mengunduh dibungkus sebagai error ekstraksi", async () => {
  await assert.rejects(
    () =>
      extractDocumentText({ mimeType: "application/pdf" }, async () => {
        throw new Error("HTTP 403");
      }),
    (error) => error instanceof DocumentExtractionError && error.code === "load"
  );
});
