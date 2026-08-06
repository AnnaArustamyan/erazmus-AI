"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Menu, User, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sidebar } from "@/components/dashboard/sidebar";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  userName?: string | null;
  tokenBalance?: number;
  plan?: string;
}

export function DashboardHeader({
  userName,
  tokenBalance,
  plan,
}: DashboardHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-muted-foreground lg:hidden">
            Erasmus AI
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-muted"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{userName ?? "Account"}</span>
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-card shadow-xl">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Sidebar
              tokenBalance={tokenBalance}
              plan={plan}
              className="border-0"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

export function DashboardShell({
  children,
  userName,
  tokenBalance,
  plan,
}: DashboardHeaderProps & { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader
        userName={userName}
        tokenBalance={tokenBalance}
        plan={plan}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          tokenBalance={tokenBalance}
          plan={plan}
          className="hidden lg:flex"
        />
        <main className={cn("flex-1 overflow-hidden")}>{children}</main>
      </div>
    </div>
  );
}
