"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCcw, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { useOrgStore, useCurrentOrgRole } from "@/hooks/useOrgStore";
import { getWorkflowsForOrg, deleteWorkflowById } from "./workflow-actions";
import { WorkflowListItem } from "./types";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkflowCard } from "./components/WorkflowCard";
import { CreateWorkflowModal } from "./components/CreateWorkflowModal";
import { EmptyState } from "./components/EmptyState";
import { OrganizationState } from "@/components/OrganizationState";

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();
    const role = useCurrentOrgRole();
    const isRoleLoaded = role !== undefined;

    const isAdmin = role === "admin";
    const isManager = role === "manager";
    const canManageWorkflows = isAdmin || isManager;

    const canView = isRoleLoaded && canManageWorkflows;
    const canCreate = isRoleLoaded && canManageWorkflows;

    const selectOrganization = useCallback(
        (orgId: string | null) => setSelectedOrgId(orgId),
        [setSelectedOrgId]
    );

    const fetchWorkflows = useCallback(
        async (refresh = false, silent = false) => {
            if (!selectedOrgId) return;

            if (!silent) {
                refresh ? setIsRefreshing(true) : setIsLoading(true);
            }

            try {
                const data = await getWorkflowsForOrg(selectedOrgId);
                setWorkflows(data as unknown as WorkflowListItem[]);

                if (refresh && !silent) toast.success("Workflows refreshed");
            } catch (error) {
                console.error("Failed to load workflows:", error);
                if (!silent) toast.error("Failed to load workflows");
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [selectedOrgId]
    );

    useEffect(() => {
        fetchWorkflows();
    }, [fetchWorkflows]);

    
    const filteredWorkflows = workflows.filter(w => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            w.name.toLowerCase().includes(query) ||
            (w.description?.toLowerCase() || "").includes(query)
        );
    });


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
            <div className="flex-1 flex items-center justify-center">
                <Card className="p-8 text-center max-w-md">
                    <h2 className="text-xl font-semibold">Access Denied</h2>
                    <p className="text-muted-foreground mt-2">
                        Only admins and managers can access workflows.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search workflows..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {canCreate && (
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Workflow
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        onClick={() => fetchWorkflows(true)}
                        disabled={isRefreshing}
                    >
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>

                {isLoading ? (
                   <LoadingSpinner message="Loading workflows..."/>
                ) : filteredWorkflows.length === 0 ? (
                    searchQuery ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No workflows found matching &quot;{searchQuery}&quot;</p>
                        </div>
                    ) : (
                        <EmptyState onCreate={canCreate ? () => setIsCreateOpen(true) : undefined} />
                    )
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredWorkflows.map(w => (
                            <WorkflowCard
                                key={w.id}
                                workflow={w}
                                onUpdate={fetchWorkflows}
                                onDelete={fetchWorkflows}
                                onStatusToggle={() => fetchWorkflows(false, true)}
                                canManage={isAdmin}
                            />
                        ))}
                    </div>
                )}
            </div>

            {canCreate && (
                <CreateWorkflowModal
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    orgId={selectedOrgId}
                    userId="user_demo"
                    onCreated={fetchWorkflows}
                />
            )}
        </>
    );
}
