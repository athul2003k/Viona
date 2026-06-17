// app/organization/[orgId]/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Settings,
  UserPlus,
  ArrowLeft,
  Mail,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useOrgStore } from "@/hooks/useOrgStore";
import { InviteEmployeeDialog } from "./components/InviteEmployeeDialog";
import { MembersTable } from "./components/MembersTable";
import { OrgSettingsDialog } from "./components/OrgSettingsDialog";
import {
  getOrganizationDetails,
  getOrganizationMembers,
  getOrganizationInvites,
  inviteEmployee,
  removeMember,
  updateMemberRole,
  cancelInvite,
} from "../actions";

interface OrgDetails {
  id: string;
  name: string;
  role: string | null;
  createdAt: string;
  stats: {
    members: number;
    products: number;
    warehouses: number;
    orders: number;
    pendingInvites: number;
  };
}

interface Member {
  id: string;
  userId: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;
  const { setSelectedOrgId } = useOrgStore();

  const [activeTab, setActiveTab] = useState("overview");
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Set selected org on mount
  useEffect(() => {
    if (orgId) {
      setSelectedOrgId(orgId);
    }
  }, [orgId, setSelectedOrgId]);

  // Load organization data
  // in page.tsx
  const loadOrgData = useCallback(async () => {
    if (!orgId || isNaN(Number(orgId))) {
      toast({
        title: "Invalid organization",
        description: "Organization id in URL is invalid.",
        variant: "destructive",
      });
      router.push("/organization");
      return;
    }
  
    setIsLoading(true);
    try {
      // First, get details and members (available to all roles)
      const [details, membersData] = await Promise.all([
        getOrganizationDetails(orgId),
        getOrganizationMembers(orgId),
      ]);
      
      setOrgDetails(details);
      setMembers(membersData);
      
      // Only fetch invites if user is admin
      if (details.role === "admin") {
        const invitesData = await getOrganizationInvites(orgId);
        setInvites(invitesData);
      } else {
        setInvites([]);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load organization",
        variant: "destructive",
      });
      router.push("/organization");
    } finally {
      setIsLoading(false);
    }
  }, [orgId, router, toast]);

  
useEffect(() => { loadOrgData(); }, [loadOrgData]);

  // Handlers
  const handleInviteEmployee = async (email: string, role: string) => {
    try {
      await inviteEmployee(orgId, email, role);
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${email}`,
      });
      setIsInviteDialogOpen(false);
      loadOrgData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send invitation",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await removeMember(orgId, memberUserId);
      toast({
        title: "Member Removed",
        description: "Member has been removed from the organization",
      });
      loadOrgData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: string) => {
    try {
      await updateMemberRole(orgId, memberUserId, newRole);
      toast({
        title: "Role Updated",
        description: "Member role has been updated",
      });
      loadOrgData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelInvite(orgId, inviteId);
      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled",
      });
      loadOrgData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  };

  const isAdmin = orgDetails?.role === "admin";

  if (isLoading) {
    return (
            <div className="flex-1 p-8">
              <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
                <Skeleton className="h-96" />
              </div>
            </div>
    );
  }

  return (
    <>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-8 space-y-6">
              {/* Back Button + Title */}
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost" className="gap-2"
                    onClick={() => router.push("/organization")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                    <p> Back to Organization</p>
                  </Button>
                  <div className="pl-7">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-8 w-8 text-primary" />
                      <h1 className="text-3xl font-bold">{orgDetails?.name}</h1>
                      <Badge variant="secondary">{orgDetails?.role}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Created {new Date(orgDetails?.createdAt || "").toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsInviteDialogOpen(true)}
                        className="gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        Invite Member
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsSettingsOpen(true)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Team Members
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{orgDetails?.stats.members}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Products
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{orgDetails?.stats.products}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Warehouses
                    </CardTitle>
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{orgDetails?.stats.warehouses}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Orders
                    </CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{orgDetails?.stats.orders}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="members">
                    Members ({members.length})
                  </TabsTrigger>
                  {isAdmin && (
                    <TabsTrigger value="invites">
                      Invites ({invites.filter(i => i.status === "pending").length})
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Quick Actions */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks for this organization</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-2">
                        <Button
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={() => router.push(`/inventory?org=${orgId}`)}
                        >
                          <Package className="h-4 w-4" />
                          View Inventory
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={() => router.push(`/orders?org=${orgId}`)}
                        >
                          <ShoppingCart className="h-4 w-4" />
                          View Orders
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={() => router.push(`/warehouse?org=${orgId}`)}
                        >
                          <Warehouse className="h-4 w-4" />
                          Manage Warehouses
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            className="justify-start gap-2"
                            onClick={() => setIsInviteDialogOpen(true)}
                          >
                            <UserPlus className="h-4 w-4" />
                            Invite Team Member
                          </Button>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recent Members */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>
                          {members.length} member{members.length !== 1 ? "s" : ""} in this organization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {members.slice(0, 5).map((member) => (
                            <div key={member.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{member.email}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {members.length > 5 && (
                            <Button
                              variant="ghost"
                              className="w-full"
                              onClick={() => setActiveTab("members")}
                            >
                              View all {members.length} members
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Members Tab */}
                <TabsContent value="members" className="mt-4">
                  <MembersTable
                    members={members}
                    currentUserRole={orgDetails?.role || "viewer"}
                    onRemove={handleRemoveMember}
                    onUpdateRole={handleUpdateRole}
                  />
                </TabsContent>

                {/* Invites Tab */}
                {isAdmin && (
                  <TabsContent value="invites" className="mt-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Pending Invitations</CardTitle>
                            <CardDescription>
                              Manage invitations sent to team members
                            </CardDescription>
                          </div>
                          <Button onClick={() => setIsInviteDialogOpen(true)} className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            New Invite
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {invites.length === 0 ? (
                          <div className="text-center py-8">
                            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No pending invitations</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {invites.map((invite) => (
                              <div
                                key={invite.id}
                                className="flex items-center justify-between p-4 border rounded-lg"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{invite.email}</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Badge variant="outline" className="capitalize">
                                        {invite.role}
                                      </Badge>
                                      <span>•</span>
                                      <Badge
                                        variant={invite.status === "pending" ? "secondary" : "outline"}
                                      >
                                        {invite.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                  {invite.status === "pending" && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => handleCancelInvite(invite.id)}
                                        >
                                          Cancel Invitation
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
          </div>
        </div>

        {/* Dialogs */}
        <InviteEmployeeDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          onInvite={handleInviteEmployee}
        />

        {isAdmin && (
          <OrgSettingsDialog
            open={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            orgId={orgId}
            orgName={orgDetails?.name || ""}
            onDeleted={() => router.push("/organization")}
          />
        )}
    </>
  );
}
