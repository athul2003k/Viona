"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrgStore, useCurrentOrgRole } from "@/hooks/useOrgStore";
import { getTeamMembers } from "./actions";
import { TeamMember } from "./types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Activity, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { OrganizationState } from "@/components/OrganizationState";

export default function EmployeesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();
  const role = useCurrentOrgRole();
  const isRoleLoaded = role !== undefined;
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const canView = isRoleLoaded && (role === "admin" || role === "manager");

  const loadMembers = useCallback(async () => {
    if (!selectedOrgId || !canView) {
      if (!canView && isRoleLoaded) {
        setIsLoading(false);
      }
      return;
    }

    try {
      setIsLoading(true);
      const data = await getTeamMembers(selectedOrgId);
      setMembers(data);
    } catch (err: any) {
      toast({
        title: "Error fetching team members",
        description: err.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId, canView, isRoleLoaded, toast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    return members.filter((m) =>
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [members, searchQuery]);

  if (orgs.length === 0 || !selectedOrgId) {
    return (
      <OrganizationState 
        hasOrganizations={orgs.length > 0} 
        hasSelectedOrg={!!selectedOrgId}
        orgs={orgs}
        selectedOrgId={selectedOrgId}
        onOrganizationSelect={setSelectedOrgId}
      />
    );
  }

  if (isRoleLoaded && !canView) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md w-full">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground mt-2">
            Only admins and managers can access the Employees section.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 md:p-8 space-y-6 flex-1 overflow-y-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
            <p className="text-muted-foreground mt-1">
              {role === "admin" 
                ? "View and manage managers and employees in your organization." 
                : "View employees in your organization."}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by email..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center h-64 border-dashed">
            <Users className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No members found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Try adjusting your search query." : "There are no team members visible to your role."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (
              <Card 
                key={member.id} 
                className="overflow-hidden hover:shadow-md transition-all cursor-pointer border-l-4 hover:border-l-primary group"
                style={{
                  borderLeftColor: 
                    member.role === 'admin' ? 'hsl(var(--destructive))' : 
                    member.role === 'manager' ? 'hsl(var(--primary))' : 
                    'hsl(var(--muted-foreground))'
                }}
                onClick={() => router.push(`/employees/${member.userId}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold">
                        {member.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base truncate max-w-[180px]" title={member.email}>
                          {member.email.split('@')[0]}
                        </CardTitle>
                        <CardDescription className="text-xs truncate max-w-[180px]">
                          {member.email}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-4">
                    <Badge variant={member.role === 'manager' ? 'default' : 'secondary'} className="capitalize">
                      {member.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Orders</div>
                      <div className="font-medium">{member.stats?.orders || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Products</div>
                      <div className="font-medium">{member.stats?.products || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Workflows</div>
                      <div className="font-medium">{member.stats?.workflows || 0}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t flex justify-end items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    View Activity <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
