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
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <label htmlFor="search-projects" className="sr-only">
          Cari berdasarkan nama proyek
        </label>
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id="search-projects"
          type="text"
          placeholder="Cari berdasarkan nama proyek..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-8"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="Hapus pencarian"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="inline-flex items-center rounded-lg bg-card p-1 border border-border text-xs font-medium select-none">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-secondary text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  isActive
                    ? "bg-primary/20 text-primary font-semibold"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
