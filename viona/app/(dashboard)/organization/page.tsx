// app/(dashboard)/organization/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Package, Warehouse, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrgStore } from "@/hooks/useOrgStore";
import { createOrganization, getUserOrganizations, getBatchOrganizationStats } from "./actions";

interface OrgWithStats {
  id: string;
  name: string;
  role: string;
  stats?: {
    members: number;
    products: number;
    warehouses: number;
    orders: number;
  };
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { orgs: organizations, setOrgs, setSelectedOrgId } = useOrgStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [orgsWithStats, setOrgsWithStats] = useState<OrgWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load organizations with stats
  useEffect(() => {
    const loadOrgsWithStats = async () => {
      setIsLoading(true);
      try {
        // Batch fetch all stats in one call (performance optimized)
        const statsMap = await getBatchOrganizationStats(organizations.map(o => o.id));

        const orgsData = organizations.map(org => ({
          ...org,
          stats: statsMap[org.id] || undefined,
        }));

        setOrgsWithStats(orgsData);
      } catch (err) {
        console.error("Failed to load org stats:", err);
        setOrgsWithStats(organizations.map(org => ({ ...org, stats: undefined })));
      } finally {
        setIsLoading(false);
      }
    };

    if (organizations.length > 0) {
      loadOrgsWithStats();
    } else {
      setIsLoading(false);
      setShowCreateForm(true);
    }
  }, [organizations]);

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newOrgId = await createOrganization(newOrgName.trim());
      toast({
        title: "Organization Created",
        description: `"${newOrgName}" has been created successfully.`,
      });

      const updatedOrgs = await getUserOrganizations();
      setOrgs(updatedOrgs);
      setSelectedOrgId(newOrgId);
      setNewOrgName("");
      setShowCreateForm(false);

      // Navigate to the new organization
      router.push(`/organization/${newOrgId}`);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOrgClick = (orgId: string) => {
    setSelectedOrgId(orgId);
    router.push(`/organization/${orgId}`);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default";
      case "manager": return "secondary";
      case "employee": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organizations and team workspaces
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Organization
          </Button>
        </div>

        {/* Create Organization Card */}
        {showCreateForm && (
          <Card className="border-dashed border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Create New Organization
              </CardTitle>
              <CardDescription>
                Set up a new workspace for your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="Organization name..."
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  disabled={isCreating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateOrganization();
                    if (e.key === "Escape") {
                      setShowCreateForm(false);
                      setNewOrgName("");
                    }
                  }}
                  className="max-w-md"
                />
                <Button
                  onClick={handleCreateOrganization}
                  disabled={!newOrgName.trim() || isCreating}
                >
                  {isCreating ? "Creating..." : "Create"}
                </Button>
                {organizations.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewOrgName("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Organizations Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orgsWithStats.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgsWithStats.map((org) => (
              <Card
                key={org.id}
                className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                onClick={() => handleOrgClick(org.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {org.name}
                      </CardTitle>
                      <Badge variant={getRoleBadgeVariant(org.role)}>
                        {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                      </Badge>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent>
                  {org.stats ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{org.stats.members} Members</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{org.stats.products} Products</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Warehouse className="h-4 w-4" />
                        <span>{org.stats.warehouses} Warehouses</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{org.stats.orders} Orders</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Click to view details
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          !showCreateForm && (
            <Card className="text-center py-12">
              <CardContent>
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first organization to get started
                </p>
                <Button onClick={() => setShowCreateForm(true)}>
                  Create Organization
                </Button>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
