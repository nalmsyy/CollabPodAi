"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProjectFilterType } from "@/types/project";
import { cn } from "@/lib/utils";

interface ProjectFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: ProjectFilterType;
  onFilterChange: (filter: ProjectFilterType) => void;
  counts: {
    all: number;
    mine: number;
    shared: number;
  };
}

export function ProjectFilter({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  counts,
}: ProjectFilterProps) {
  const filterTabs: { id: ProjectFilterType; label: string; count: number }[] = [
    { id: "all", label: "Semua", count: counts.all },
    { id: "mine", label: "Milik saya", count: counts.mine },
    { id: "shared", label: "Diikuti", count: counts.shared },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Filter Tabs — tampilan segmented seperti referensi */}
      <div className="inline-flex items-center rounded-lg bg-card border border-border p-1 text-[13px] font-medium select-none gap-0.5">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                isActive
                  ? "bg-[#e3e8d8] text-[#4d6037] font-[550]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  isActive
                    ? "text-[#4d6037] font-semibold"
                    : "text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative max-w-xs w-full sm:w-auto">
        <label htmlFor="search-projects" className="sr-only">
          Cari berdasarkan nama proyek
        </label>
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          id="search-projects"
          type="text"
          placeholder="Cari proyek…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 pr-8 h-9 text-[13px] bg-card"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="Hapus pencarian"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
