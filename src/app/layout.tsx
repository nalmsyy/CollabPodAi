import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollabPod AI — Academic Workspace",
  description:
    "Ruang kolaborasi tugas dan penelitian kecil untuk kelompok mahasiswa berbasis Solid Pod dan AI terpercaya.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
