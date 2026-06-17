"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { OrganizationSelector } from "@/app/(dashboard)/organization/components/OrganizationSelector";

interface OrganizationStateProps {
  hasOrganizations: boolean;
  hasSelectedOrg: boolean;
  orgs?: any[];
  selectedOrgId?: string | null;
  onOrganizationSelect?: (id: string) => void;
  noOrgTitle?: string;
  noOrgDescription?: string;
  selectOrgTitle?: string;
  selectOrgDescription?: string;
}

export function OrganizationState({ 
  hasOrganizations, 
  hasSelectedOrg,
  orgs = [],
  selectedOrgId,
  onOrganizationSelect,
  noOrgTitle = "No Organization Found",
  noOrgDescription = "Create or join an organization to continue.",
  selectOrgTitle = "Select Organization",
  selectOrgDescription = "Please select an organization from below to view this page."
}: OrganizationStateProps) {
  if (!hasOrganizations) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md w-full">
          <h2 className="text-xl font-semibold">{noOrgTitle}</h2>
          <p className="text-muted-foreground mt-2 mb-4">
            {noOrgDescription}
          </p>
          <Button asChild>
            <Link href="/organization">Create Organization</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!hasSelectedOrg) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-sm w-full space-y-4 shadow-sm border">
          <h2 className="text-xl font-semibold">{selectOrgTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {selectOrgDescription}
          </p>
          {orgs.length > 0 && onOrganizationSelect && (
            <OrganizationSelector
              organizations={orgs}
              selectedOrgId={selectedOrgId || null}
              onOrganizationSelect={onOrganizationSelect}
            />
          )}
        </Card>
      </div>
    );
  }

  return null;
}
