"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  CalendarDays,
  Target,
  Search,
  BookOpen,
  Mic,
  Settings,
  Leaf,
  Network,
  LineChart,
  Bot,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/billing/trial-banner";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_GROUPS: { heading?: string; items: NavItem[] }[] = [
  {
    heading: "Content",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    heading: "Strategy",
    items: [
      { label: "Strategy", href: "/strategy", icon: Target },
      { label: "Keywords", href: "/keywords", icon: Search },
      { label: "Content Map", href: "/content-map", icon: Network },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      { label: "Performance", href: "/performance", icon: LineChart },
      { label: "Agents", href: "/agents", icon: Bot },
    ],
  },
  {
    heading: "Brand",
    items: [
      { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
      { label: "Voice Builder", href: "/voice-builder", icon: Mic },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function NavSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r bg-card min-h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b">
        <Leaf className="h-5 w-5 text-green-600" />
        <span className="font-semibold text-base tracking-tight">DemandLeaf</span>
      </div>

      <TrialBanner />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.heading && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {gi < NAV_GROUPS.length - 1 && (
              <Separator className="mt-3" />
            )}
          </div>
        ))}

        <Separator />

        {/* Bottom nav items */}
        <ul className="space-y-0.5">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t px-3 py-3 flex items-center gap-2.5">
        <UserButton />
        {user?.primaryEmailAddress && (
          <p className="text-xs text-muted-foreground truncate">
            {user.primaryEmailAddress.emailAddress}
          </p>
        )}
      </div>
    </aside>
  );
}
