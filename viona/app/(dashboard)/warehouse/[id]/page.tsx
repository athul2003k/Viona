"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, RefreshCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorAlert } from "../components/ErrorAlert";
import { WarehouseProductsTable } from "../components/WarehouseProductsTable";
import { WarehouseInventoryPieChart } from "../components/WarehouseInventoryPieChart";

type ProductStock = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  imageUrl?: string;
};

type WarehouseDetail = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  productStocks: ProductStock[];
  totalStock: number;
  productCount: number;
};

export default function WarehouseDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const warehouseId = params.id as string;
  const orgId = searchParams.get("orgId");

  const [warehouse, setWarehouse] = useState<WarehouseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWarehouseDetails = useCallback(async () => {
    if (!warehouseId || !orgId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/warehouses/${warehouseId}?orgId=${orgId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch warehouse: ${res.status}`);
      }
      const data: WarehouseDetail = await res.json();
      setWarehouse(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load warehouse.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [warehouseId, orgId]);

  useEffect(() => {
    fetchWarehouseDetails();
  }, [fetchWarehouseDetails]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="Loading warehouse..." />
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <ErrorAlert message={error || "Warehouse not found"} onDismiss={() => router.back()} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-6 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warehouses
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchWarehouseDetails}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Warehouse Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{warehouse.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{warehouse.address}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{warehouse.productCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Stock</p>
                <p className="text-2xl font-bold">{warehouse.totalStock.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{new Date(warehouse.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm">{new Date(warehouse.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PIE CHART */}
        <WarehouseInventoryPieChart products={warehouse.productStocks} />

        {/* Product Table */}
        <WarehouseProductsTable products={warehouse.productStocks} />
      </div>
    </div>
  );
}
