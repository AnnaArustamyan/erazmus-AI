"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn, formatTokenCount } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban, disabled: true },
  { href: "/agents", label: "AI Agents", icon: Bot, disabled: true },
  { href: "/documents", label: "Documents", icon: FileText, disabled: true },
  { href: "/billing", label: "Billing", icon: CreditCard, disabled: true },
  { href: "/settings", label: "Settings", icon: Settings, disabled: true },
];

interface SidebarProps {
  tokenBalance?: number;
  plan?: string;
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({
  tokenBalance,
  plan,
  className,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          E+
        </div>
        <span className="font-semibold tracking-tight">Erasmus AI</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon, disabled }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);

          if (disabled) {
            return (
              <div
                key={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
                title="Coming in Phase 2-3"
              >
                <Icon className="h-4 w-4" />
                {label}
                <span className="ml-auto text-xs">Soon</span>
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {tokenBalance !== undefined && (
        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Token balance</p>
            <p className="text-lg font-semibold">
              {formatTokenCount(tokenBalance)}
            </p>
            {plan && (
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {plan.toLowerCase()} plan
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
