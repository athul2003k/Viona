// File: app/(dashboard)/inventory/page.tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ProductTable } from "./components/ProductTable";
import { AddProductDialog } from "./components/AddProductDialog";
import { InventoryFilters, FilterState } from "./components/InventoryFilters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Building2, Package, Plus, RefreshCcw } from "lucide-react";
import { addProduct, updateProduct, deleteProduct } from "./actions";
import { useOrgStore } from "@/hooks/useOrgStore";
import { useDebounce } from "@/hooks/useDebounce";
import type { Product } from "../../api/inventory/products/route";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Pagination } from "@/components/Pagination";
import { InventoryStats } from "./components/InventoryStats";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { Download } from "lucide-react";
import { OrganizationState } from "@/components/OrganizationState";

import { getRole } from "@/app/(dashboard)/orders/actions"; 

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  const [isErrorVisible, setIsErrorVisible] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    sortBy: "name",
    sortOrder: "asc",
    stockFilter: "all",
  });
  
  const debouncedSearch = useDebounce(filters.search, 400);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  // RBAC state
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // Get data from Zustand store - organizations are now loaded globally
  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();

  // Organization selection handler
  const selectOrganization = useCallback(
    (orgId: string | null) => {
      setSelectedOrgId(orgId);
      setSelectedProductIds(new Set());
    },
    [setSelectedOrgId]
  );

  // RBAC: fetch role whenever org changes
  useEffect(() => {
    if (!selectedOrgId) {
      setRole(null);
      return;
    }

    setRoleLoading(true);
    getRole(selectedOrgId)
      .then(setRole)
      .catch(() => setRole(null))
      .finally(() => setRoleLoading(false));
  }, [selectedOrgId]);

  // can helper (same semantics as Orders)
  const can = (allowed: string[]) => {
    if (!role) return false;
    if (role === "admin") return true;
    return allowed.includes(role);
  };

  // Auto-hide error after 5 seconds with smooth animation
  useEffect(() => {
    if (error) {
      setIsErrorVisible(true);
      const timer = setTimeout(() => {
        setIsErrorVisible(false);
        // Remove error completely after animation
        setTimeout(() => setError(null), 300);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchProducts = useCallback(
    async (showRefreshing = false) => {
      if (!selectedOrgId) {
        setProducts([]); // Clear products when no org selected
        setTotalItems(0);
        return;
      }

      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          orgId: selectedOrgId,
          page: currentPage.toString(),
          pageSize: pageSize.toString(),
          search: debouncedSearch,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          stockFilter: filters.stockFilter,
        });

        const res = await fetch(`/api/inventory/products?${queryParams.toString()}`);
        if (!res.ok) {
          if (res.status === 404) {
            setProducts([]);
            setTotalItems(0);
            return;
          }
          throw new Error(`Failed to fetch products: ${res.status}`);
        }

        const json = await res.json();
        // The new API signature is { data: Product[], total: number, page: number, pageSize: number, totalPages: number }
        if (json.data && Array.isArray(json.data)) {
          setProducts(json.data);
          setTotalItems(json.total || 0);
          setTotalPages(json.totalPages || 1);
        } else {
          // Fallback if API hasn't updated
          setProducts(Array.isArray(json) ? json : []);
          setTotalItems(Array.isArray(json) ? json.length : 0);
        }
      } catch (fetchError) {
        console.error("Fetch products error:", fetchError);
        setProducts([]);
        setTotalItems(0);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load products. Please try again."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedOrgId, currentPage, debouncedSearch, filters.sortBy, filters.sortOrder, filters.stockFilter]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Client-side filtering and slicing is completely REMOVED.
  // We just use `products` directly because it comes pre-filtered and paginated from the server.

  // Reset page when filters change (ignoring page changes themselves)
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.sortBy, filters.sortOrder, filters.stockFilter]);

  const handleAddProduct = async (
    newProduct: Omit<Product, "id" | "createdAt" | "updatedAt">
  ) => {
    if (!selectedOrgId) {
      setError("Please select an organization first");
      return;
    }

    // RBAC: e.g. admin, manager, employee can add
    if (!can(["manager"])) {
      setError("You do not have permission to add products.");
      return;
    }

    try {
      setError(null);
      await addProduct(selectedOrgId, newProduct);
      await fetchProducts(); // Refresh the products list
      setIsDialogOpen(false);
    } catch (addError) {
      console.error("Add product error:", addError);
      setError(
        addError instanceof Error ? addError.message : "Failed to add product"
      );
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!selectedOrgId) {
      setError("Please select an organization first");
      return;
    }

    // RBAC: e.g. only admin + manager can delete
    if (!can(["manager"])) {
      setError("You do not have permission to delete products.");
      return;
    }

    try {
      setError(null);
      await deleteProduct(selectedOrgId, id);
      await fetchProducts(); // Refresh the products list
      setSelectedProductIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      })
    } catch (deleteError) {
      console.error("Delete product error:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete product"
      );
    }
  };

  const handleUpdateProduct = async (
    id: string,
    updatedProduct: Omit<Product, "id" | "createdAt" | "updatedAt">
  ) => {
    if (!selectedOrgId) {
      setError("Please select an organization first");
      return;
    }

    
    if (!can(["manager","admin"])) {
      setError("You do not have permission to update products.");
      return;
    }

    try {
      setError(null);
      await updateProduct(selectedOrgId, id, updatedProduct);
      await fetchProducts(); // Refresh the products list
    } catch (updateError) {
      console.error("Update product error:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update product"
      );
    }
  };

  const dismissError = () => {
    setIsErrorVisible(false);
    setTimeout(() => setError(null), 300);
  };

  const handleBulkDelete = async () => {
    if (!selectedOrgId || selectedProductIds.size === 0) return;
    if (!can(["manager"])) {
      setError("You do not have permission to delete products.");
      return;
    }
    
    try {
      const idsToDelete = Array.from(selectedProductIds);
      await Promise.all(idsToDelete.map(id => deleteProduct(selectedOrgId, id)));
      await fetchProducts();
      setSelectedProductIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete products");
    }
  };

  const handleExport = () => {
    const csvData = products.map(product => ({
      ID: product.id,
      Name: product.name,
      SKU: product.sku,
      Price: product.price,
      Stock: product.stock,
      Category: product.categoryId || "None",
      CreatedAt: new Date(product.createdAt).toLocaleDateString(),
    }));

    const csvString = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
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
        onOrganizationSelect={selectOrganization}
      />
    );
  }

  // Case 3: Organization is selected - show inventory interface
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
          {/* Error Alert with smooth animation */}
          {error && (
            <div
              className={`transition-all duration-300 ease-in-out transform ${
                isErrorVisible
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 -translate-y-2 scale-95"
              }`}
            >
              <Alert variant="destructive" className="relative">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="pr-8">
                  {error}
                </AlertDescription>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-red-100"
                  onClick={dismissError}
                >
                  <span className="text-red-600">×</span>
                </Button>
              </Alert>
            </div>
          )}

          {/* Stats Cards */}
          {can(["admin", "manager", "employee"]) && (
            <InventoryStats products={products} />
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {/* RBAC: Add Product visible only for allowed roles */}
              {can(["manager"]) && (
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  disabled={isLoading || roleLoading}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => fetchProducts(true)}
                disabled={isRefreshing}
                className="shrink-0"
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* Export Button */}
              {can(["manager", "admin"]) && products.length > 0 && (
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
              {/* Only show filters if we have products or are loading */}
              {(products.length > 0 || isLoading || totalItems > 0) && (
                <InventoryFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  totalProducts={totalItems}
                  filteredCount={products.length}
                />
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {can(["manager", "admin"]) && selectedProductIds.size > 0 && (
            <BulkActionsBar
              selectedCount={selectedProductIds.size}
              onDeleteSelected={handleBulkDelete}
              onClearSelection={() => setSelectedProductIds(new Set())}
            />
          )}

          {/* Main Content Area */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner message="Loading products..." />
            </div>
          ) : (
            <>
              {/* Case: No products AT ALL in the organization */}
              {totalItems === 0 && !filters.search && filters.stockFilter === 'all' ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center max-w-md mx-auto">
                    <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Products Yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Get started by adding your first product to the inventory. You
                      can track stock levels, prices, and manage your product catalog.
                    </p>
                    {can(["manager"]) && (
                      <Button
                        onClick={() => setIsDialogOpen(true)}
                        className="w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Product
                      </Button>
                    )}
                  </div>
                </div>
              ) : products.length === 0 ? (
                /* Case: Filters are active but yielded no results */
                <div className="flex flex-col items-center justify-center py-20 bg-muted/20 border border-dashed rounded-lg">
                  <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No matches found</h3>
                  <p className="text-muted-foreground mb-6 max-w-xs text-center">
                    We couldn't find any products matching your search or filter criteria.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFilters({
                        search: "",
                        sortBy: "name",
                        sortOrder: "asc",
                        stockFilter: "all",
                      })
                    }
                  >
                    Clear All Filters
                  </Button>
                </div>
              ) : (
                /* Case: We have products to display */
                <div className="pb-6">
                  <ProductTable
                    products={products}
                    selectedIds={selectedProductIds}
                    onSelectionChange={setSelectedProductIds}
                    onDelete={can(["manager"]) ? handleDeleteProduct : undefined}
                    onUpdate={can(["admin", "manager", "employee"]) ? handleUpdateProduct : undefined}
                    isLoading={isLoading || isRefreshing}
                    isEmployee={role === "employee"}
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

          <AddProductDialog
            // RBAC: disallow dialog opening if user cannot add
            open={isDialogOpen && can(["manager"])}
            onOpenChange={setIsDialogOpen}
            onSave={handleAddProduct}
            orgId={selectedOrgId}
          />
        </div>
  );
}
