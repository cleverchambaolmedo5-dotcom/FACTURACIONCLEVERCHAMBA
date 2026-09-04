"use client";

import { useState } from "react";
import type { ModuleContext, ModuleKey } from "@/config/navigation";
import type { PublicUser } from "@/lib/auth/session";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { MobileNavigation } from "./mobile-navigation";

// Owns the one bit of client state this layout needs (is the mobile nav
// open) and composes the Sidebar/Header/MobileNavigation around it. The
// actual auth + RBAC + module-context computation happens server-side in
// src/app/(app)/layout.tsx, which passes the already-filtered
// `allowedKeys` and the resolved `moduleContext` down as plain data.
export function AppShell({
  user,
  allowedKeys,
  moduleContext,
  children,
}: {
  user: PublicUser;
  allowedKeys: ModuleKey[];
  moduleContext: ModuleContext;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar user={user} allowedKeys={allowedKeys} moduleContext={moduleContext} />
      <MobileNavigation
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        allowedKeys={allowedKeys}
        moduleContext={moduleContext}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex flex-1 flex-col p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
