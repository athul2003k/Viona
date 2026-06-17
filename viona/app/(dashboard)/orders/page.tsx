"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCcw, Download } from "lucide-react";
import { useOrgStore } from "@/hooks/useOrgStore";
import { OrganizationSelector } from "@/app/(dashboard)/organization/components/OrganizationSelector";
import { OrderTable } from "./components/OrderTable";
import { AddOrderDialog } from "./components/AddOrderDialog";
import { OrderFilters, FilterState } from "./components/OrderFilters";
import { OrderStats } from "./components/OrderStats";
import { EmptyState } from "./components/EmptyState";
import { OrganizationState } from "@/components/OrganizationState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Pagination } from "@/components/Pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorAlert } from "./components/ErrorAlert";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { addOrder, updateOrder, deleteOrder, bulkUpdateOrders, getRole } from "./actions";
import type { Order } from "../../api/orders/route";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    sortBy: "orderDate",
    sortOrder: "desc",
    statusFilter: "all",
    dateFrom: null,
    dateTo: null,
  });
  
  const debouncedSearch = useDebounce(filters.search, 400);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  const [role,setRole] = useState<string | null>(null);
  const [roleLoading,setRoleLoading] = useState(true);

  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();

  const selectOrganization = useCallback((orgId: string | null) => {
    setSelectedOrgId(orgId);
    setSelectedOrderIds(new Set());
  }, [setSelectedOrgId]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (!selectedOrgId) return;
  
    setRoleLoading(true);
  
    getRole(selectedOrgId)
      .then(setRole)
      .catch(() => setRole(null))
      .finally(() => setRoleLoading(false));
  }, [selectedOrgId]);

  const fetchOrders = useCallback(async (showRefreshing = false) => {
    if (!selectedOrgId) {
      setOrders([]);
      setTotalItems(0);
      return;
    }

    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    const queryParams = new URLSearchParams({
      orgId: selectedOrgId,
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
      search: debouncedSearch,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      statusFilter: filters.statusFilter,
    });

    if (filters.dateFrom) queryParams.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) queryParams.append("dateTo", filters.dateTo);

    try {
      const res = await fetch(`/api/orders?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch orders: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      
      if (data && Array.isArray(data.data)) {
        setOrders(data.data);
        setTotalItems(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setOrders(Array.isArray(data) ? data : []);
        setTotalItems(Array.isArray(data) ? data.length : 0);
        setTotalPages(1);
      }
      
      if (showRefreshing) {
        toast.success("Orders refreshed successfully");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load orders.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrgId, currentPage, debouncedSearch, filters.sortBy, filters.sortOrder, filters.statusFilter, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const can = (allowed: string[]) => {
    if (!role) return false;
    if (role === 'admin') return true;
    return allowed.includes(role);
  };

  // Client-side filtering and slicing is completely REMOVED.
  // We use `orders` directly because it comes pre-filtered and paginated from the server.
  const filteredOrders = orders;
  const paginatedOrders = orders;

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filters.sortBy, filters.sortOrder, filters.statusFilter, filters.dateFrom, filters.dateTo]);

  const handleAddOrUpdateOrder = async (orderData: any) => {
    if (!selectedOrgId) {
      const errorMsg = "Please select an organization first.";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setError(null);
      const isEditing = !!editingOrder;
      
      if (isEditing) {
        const result = await updateOrder(selectedOrgId, editingOrder.id, orderData);
        if (result && !result.success && 'error' in result) throw new Error(result.error as string);
        toast.success("Order updated successfully");
      } else {
        const result = await addOrder(selectedOrgId, orderData);
        if (result && !result.success && 'error' in result) throw new Error(result.error as string);
        toast.success("Order created successfully");
      }
      
      await fetchOrders();
      setIsDialogOpen(false);
      setEditingOrder(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save order.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!selectedOrgId) return;

    try {
      setError(null);
      const result = await deleteOrder(selectedOrgId, id);
      if (result && !result.success && 'error' in result) throw new Error(result.error as string);
      
      await fetchOrders();
      setSelectedOrderIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast.success("Order deleted successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete order.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setIsDialogOpen(true);
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (!selectedOrgId || selectedOrderIds.size === 0) return;

    try {
      const updates = Array.from(selectedOrderIds).map(id => {
        const order = orders.find(o => o.id === id);
        return {
          id,
          data: {
            orderDate: order?.orderDate || new Date().toISOString(),
            status,
            totalAmount: order?.totalAmount || 0,
            orderItems: order?.orderItems || [],
          }
        };
      });

      const result = await bulkUpdateOrders(selectedOrgId, updates);
      if (result && !result.success && 'error' in result) throw new Error(result.error as string);
      
      await fetchOrders();
      setSelectedOrderIds(new Set());
      toast.success(`Updated ${updates.length} orders successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update orders.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleExport = () => {
    // Basic CSV export functionality
    const csvData = filteredOrders.map(order => ({
      ID: order.id,
      Date: new Date(order.orderDate).toLocaleDateString(),
      Customer: order.customer.name,
      Email: order.customer.email,
      Status: order.status,
      Total: order.totalAmount,
      Items: order.orderItems.length,
    }));

    const csvString = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (orgs.length === 0 || !selectedOrgId) {
    return (
      <OrganizationState 
        hasOrganizations={orgs.length > 0} 
        hasSelectedOrg={!!selectedOrgId}
        orgs={orgs}
        selectedOrgId={selectedOrgId}
        onOrganizationSelect={setSelectedOrgId}
        noOrgDescription="You need to create or join an organization to manage orders."
        selectOrgDescription="Please select an organization to view and manage orders."
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

        {/* Stats Cards */}
        {can(['admin','manager']) && (
          <OrderStats orders={orders} />
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 gap-4">
          <div className="flex items-center gap-2 flex-wrap">
           {can(['admin','manager','employee']) && ( <Button 
              onClick={() => { 
                setEditingOrder(null); 
                setIsDialogOpen(true); 
              }} 
              disabled={isLoading}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Order
            </Button>)}
            
            <Button
              variant="outline"
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing}
              className="shrink-0"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            { can(['admin','manager']) && filteredOrders.length > 0 && (
              <Button
                variant="outline"
                onClick={handleExport}
                className="shrink-0"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>

          <div className="shrink-0">
            {(orders.length > 0 || isLoading || totalItems > 0) && (
              <OrderFilters
                filters={filters}
                onFiltersChange={setFilters}
                totalOrders={totalItems}
                filteredCount={orders.length}
              />
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {can(['admin','manager']) && selectedOrderIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedOrderIds.size}
            onStatusUpdate={handleBulkStatusUpdate}
            onClearSelection={() => setSelectedOrderIds(new Set())}
          />
        )}

        {/* Main Content Area */}
        {isLoading ? (
          <LoadingSpinner message="Loading orders..."/>
        ) : (
          <>
            {/* Case: No orders AT ALL in the organization */}
            {totalItems === 0 && !filters.search && filters.statusFilter === 'all' && !filters.dateFrom && !filters.dateTo ? (
              <EmptyState onAddOrder={() => setIsDialogOpen(true)} />
            ) : orders.length === 0 ? (
              /* Case: Filters are active but yielded no results */
              <Card className="p-8 text-center border-dashed bg-muted/20">
                <h3 className="text-lg font-medium mb-2">No orders match your filters</h3>
                <p className="text-muted-foreground mb-6">
                  We couldn't find any orders matching your current search or filter criteria.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setFilters({
                    search: "",
                    sortBy: "orderDate",
                    sortOrder: "desc",
                    statusFilter: "all",
                    dateFrom: null,
                    dateTo: null,
                  })}
                >
                  Clear All Filters
                </Button>
              </Card>
            ) : (
              /* Case: We have orders to display */
              <div className="pb-6">
                <OrderTable
                  orders={paginatedOrders}
                  selectedIds={selectedOrderIds}
                  onSelectionChange={setSelectedOrderIds}
                  onDelete={can(['admin', 'manager','employee']) ? handleDeleteOrder : undefined}
                  onEdit={handleEditOrder}
                  sortBy={filters.sortBy}
                  sortOrder={filters.sortOrder}
                  onSort={(field, order) => setFilters(prev => ({ ...prev, sortBy: field, sortOrder: order }))}
                  isEmployee={can(['employee'])}
                />
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}

        <AddOrderDialog
          open={isDialogOpen && can(['admin','manager', 'employee'])}
          onOpenChange={setIsDialogOpen}
          onSave={handleAddOrUpdateOrder}
          initialData={editingOrder}
          orgId={selectedOrgId}
        />
      </div>
    </div>
  );
}
