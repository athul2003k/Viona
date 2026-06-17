"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbHeader } from "@/components/BreadcrumbHeader";
import { SearchBar } from "@/components/SearchBar";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { ModeToggle } from "@/components/ThemeModeToggle";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { OrganizationSelector } from "@/app/(dashboard)/organization/components/OrganizationSelector";
import { useOrgStore } from "@/hooks/useOrgStore";

// Routes where the OrganizationSelector should NOT appear in the header.
// Dynamic sub-routes (starting with these prefixes) are also excluded.
const ROUTES_WITHOUT_ORG_SELECTOR = [
  "/organization",
  "/chat",
  "/storage",
  "/notifications",
  "/credentials",
];

function shouldShowOrgSelector(pathname: string): boolean {
  // Exact match or prefix match for the exclusion list
  return !ROUTES_WITHOUT_ORG_SELECTOR.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export const DashboardHeader = React.memo(function DashboardHeader() {
  const pathname = usePathname();
  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();
  const { resolvedTheme } = useTheme();

  // Check if we are in the workflow editor (e.g., /workflows/[workflowId])
  const isWorkflowEditor = pathname.match(/^\/workflows\/[^/]+$/);
  if (isWorkflowEditor) return null;

  const showOrgSelector = shouldShowOrgSelector(pathname);

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 h-[50px] w-full gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 relative z-40">
        <BreadcrumbHeader />
        {showOrgSelector && orgs.length > 0 && (
          <div className="flex-1 max-w-xs">
            <OrganizationSelector
              organizations={orgs}
              selectedOrgId={selectedOrgId}
              onOrganizationSelect={(id) => setSelectedOrgId(id)}
            />
          </div>
        )}
        <SearchBar />
        <NotificationDropdown />
        <div className="flex items-center gap-4">
          <ModeToggle />
          <SignedIn>
            <UserButton appearance={{ baseTheme: resolvedTheme === "dark" ? dark : undefined }} />
          </SignedIn>
        </div>
      </header>
      <Separator />
    </>
  );
});
