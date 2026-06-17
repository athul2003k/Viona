"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrgStore, useCurrentOrgRole } from "@/hooks/useOrgStore";
import { getMemberDetails, getMemberActivity } from "../actions";
import { TeamMember, MemberActivity } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ShoppingCart, Package, Layers2Icon, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { OrganizationState } from "@/components/OrganizationState";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { toast } = useToast();
  
  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();
  const role = useCurrentOrgRole();
  const isRoleLoaded = role !== undefined;
  
  const [member, setMember] = useState<TeamMember | null>(null);
  const [activity, setActivity] = useState<MemberActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const canView = isRoleLoaded && (role === "admin" || role === "manager");

  const loadMemberData = useCallback(async () => {
    if (!selectedOrgId || !userId || !canView) {
      if (!canView && isRoleLoaded) {
        setIsLoading(false);
      }
      return;
    }

    try {
      setIsLoading(true);
      const [memberData, activityData] = await Promise.all([
        getMemberDetails(selectedOrgId, userId),
        getMemberActivity(selectedOrgId, userId)
      ]);
      
      setMember(memberData);
      setActivity(activityData);
    } catch (err: any) {
      toast({
        title: "Error loading member details",
        description: err.message || "Please try again later.",
        variant: "destructive",
      });
      router.push('/employees');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId, userId, canView, isRoleLoaded, router, toast]);

  useEffect(() => {
    loadMemberData();
  }, [loadMemberData]);

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

  if (isLoading) {
    return (
      <div className="flex-1 p-8 space-y-6 overflow-y-auto">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (!member || !activity) {
    return null;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 md:p-8 space-y-6 flex-1 overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/employees')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{member.email}</h1>
              <Badge variant={member.role === 'manager' ? 'default' : 'secondary'} className="capitalize">
                {member.role}
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm">
              <Clock className="h-3.5 w-3.5" />
              Joined {new Date(member.joinedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders Placed</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activity.orderCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Products Created</CardTitle>
              <Package className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activity.productCreatedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Products Modified</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activity.productModifiedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Workflows</CardTitle>
              <Layers2Icon className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activity.workflowCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview">Recent Activity</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>The last 5 orders placed by this member.</CardDescription>
              </CardHeader>
              <CardContent>
                {activity.recentOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center italic">No orders placed yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activity.recentOrders.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <ShoppingCart className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Order #{order.id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(order.date).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">{order.status}</Badge>
                          <span className="font-semibold text-sm">${order.total.toFixed(2)}</span>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/orders/${order.id}`)}>View</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recently Created Products</CardTitle>
                <CardDescription>The latest inventory items added by this member.</CardDescription>
              </CardHeader>
              <CardContent>
                {activity.recentProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center italic">No products created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activity.recentProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="bg-emerald-500/10 p-2 rounded-full">
                            <Package className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/inventory?search=${product.sku}`)}>View</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Workflows</CardTitle>
                <CardDescription>Automations created or updated by this member.</CardDescription>
              </CardHeader>
              <CardContent>
                {activity.recentWorkflows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center italic">No workflows created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activity.recentWorkflows.map(workflow => (
                      <div key={workflow.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="bg-purple-500/10 p-2 rounded-full">
                            <Layers2Icon className="h-4 w-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{workflow.name}</p>
                            <p className="text-xs text-muted-foreground">Updated {new Date(workflow.updatedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                            {workflow.status}
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/workflows/${workflow.id}`)}>Edit</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
