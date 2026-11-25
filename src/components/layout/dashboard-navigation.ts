import { FolderKanban, Inbox, Users } from "lucide-react";
export const dashboardNavigation = [
  { tab: "all", label: "Semua proyek", href: "/dashboard", icon: FolderKanban },
  {
    tab: "shared",
    label: "Dibagikan ke saya",
    href: "/dashboard?tab=shared",
    icon: Users,
  },
  {
    tab: "invites",
    label: "Undangan",
    href: "/dashboard?tab=invites",
    icon: Inbox,
  },
];
