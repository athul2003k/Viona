"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCcw } from "lucide-react";
import { useOrgStore, useCurrentOrgRole } from "@/hooks/useOrgStore";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { Warehouse } from "../../api/warehouses/route";
import { WarehouseGrid } from "./components/WarehouseGrid";
import { AddWarehouseDialog } from "./components/AddWarehouseDialog";
import { WarehouseStats } from "./components/WarehouseStats";
import { EmptyState } from "./components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorAlert } from "./components/ErrorAlert";
import { createWarehouse, ensureDefaultWarehouse } from "./actions";
import { OrganizationState } from "@/components/OrganizationState";

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();
  const role = useCurrentOrgRole();
  const isRoleLoaded = role !== undefined;

  const isEmployee = role === "employee";
  const isManager = role === "manager";
  const isAdmin = role === "admin";

  const canViewWarehouses = isRoleLoaded;
  const canCreateWarehouse = isRoleLoaded && isAdmin;

  const selectOrganization = useCallback((orgId: string | null) => {
    setSelectedOrgId(orgId);
  }, [setSelectedOrgId]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchWarehouses = useCallback(async (showRefreshing = false) => {
    if (!selectedOrgId) {
      setWarehouses([]);
      return;
    }

    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Ensure default warehouse exists
      await ensureDefaultWarehouse(selectedOrgId);

      const res = await fetch(`/api/warehouses?orgId=${selectedOrgId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch warehouses: ${res.status} ${res.statusText}`);
      }
      const data: Warehouse[] = await res.json();
      setWarehouses(Array.isArray(data) ? data : []);

      if (showRefreshing) {
        toast.success("Warehouses refreshed successfully");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load warehouses.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleAddWarehouse = async (data: { name: string; address: string }) => {
    if (!selectedOrgId) {
      const errorMsg = "Please select an organization first.";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setError(null);
      await createWarehouse(selectedOrgId, data);
      toast.success("Warehouse created successfully");
      await fetchWarehouses();
      setIsDialogOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create warehouse.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (orgs.length === 0 || !selectedOrgId) {
    return (
      <OrganizationState 
        hasOrganizations={orgs.length > 0} 
        hasSelectedOrg={!!selectedOrgId}
        orgs={orgs}
        selectedOrgId={selectedOrgId}
        onOrganizationSelect={selectOrganization}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-6 p-4 md:p-8 pt-6">
        {error && (
          <ErrorAlert
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {warehouses.length > 0 && <WarehouseStats warehouses={warehouses} />}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 gap-4">
          <div className="flex items-center gap-2">
            {canCreateWarehouse && (
              <Button onClick={() => setIsDialogOpen(true)} disabled={isLoading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Warehouse
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => fetchWarehouses(true)}
              disabled={isRefreshing}
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner message="Loading warehouses..." />
        ) : warehouses.length === 0 ? (
          <EmptyState
            onAddWarehouse={
              canCreateWarehouse ? () => setIsDialogOpen(true) : undefined
            }
          />

        ) : (
          <WarehouseGrid
            warehouses={warehouses}
            onRefresh={fetchWarehouses}
            orgId={selectedOrgId}
          />
        )}

        {canCreateWarehouse && (
          <AddWarehouseDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSave={handleAddWarehouse}
          />
        )}

      </div>
    </div>
  );
}
