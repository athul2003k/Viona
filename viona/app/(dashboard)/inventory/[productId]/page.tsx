"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Package,
  DollarSign,
  Warehouse,
  TrendingUp,
  TrendingDown,
  Percent,
  Info,
  Edit,
  Trash2,
  AlertCircle,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { deactivateProduct } from "@/app/(dashboard)/inventory/actions";

import { useOrgStore, useCurrentOrgRole } from "@/hooks/useOrgStore";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import * as StorageApi from "@/lib/storageApi";
import { getWarehousesWithStock } from "@/app/(dashboard)/inventory/actions";

import {
  getProductDetails,
  updateProductDetails,
  deleteProductDetails,
  activateProduct,
  updateProductStatus,
} from "@/app/(dashboard)/inventory/actions";

import ProductHeaderSkeleton from "@/app/(dashboard)/inventory/components/ProductHeaderSkeleton";
import ProductImageCard from "@/app/(dashboard)/inventory/components/ProductImageCard";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Power, PowerOff, Archive } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { OrganizationState } from "@/components/OrganizationState";

// Dynamic chunks for heavy UI
const EditProductDialog = dynamic(
  () =>
    import("@/app/(dashboard)/inventory/components/EditProductDialog").then(
      (m) => ({
        default: m.EditProductDialog,
      }),
    ),
  { ssr: false },
);

const StockTransferDialog = dynamic(
  () =>
    import("@/app/(dashboard)/inventory/components/StockTransferDialog").then(
      (m) => ({
        default: m.StockTransferDialog,
      }),
    ),
  { ssr: false },
);

const StockDistributionChart = dynamic(
  () =>
    import("@/app/(dashboard)/inventory/components/charts/StockDistributionChart"),
  { ssr: false },
);

const PriceHistoryChart = dynamic(
  () =>
    import("@/app/(dashboard)/inventory/components/charts/PriceHistoryChart"),
  { ssr: false },
);

const OrderTrendChart = dynamic(
  () => import("@/app/(dashboard)/inventory/components/charts/OrderTrendChart"),
  { ssr: false },
);

const RecentOrdersTable = dynamic(
  () => import("@/app/(dashboard)/inventory/components/RecentOrdersTable"),
  { ssr: false },
);

type WarehouseOption = { id: string; name: string; address?: string };

type ProductDetails = {
  id: string;
  name: string;
  sku: string;
  description?: string;
  image?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; email: string };
  modifiedBy?: { id: string; email: string } | null;
  warehouses: Array<{
    id: string;
    name: string | null;
    address?: string;
    stock: number;
  }>;
  priceHistory: Array<{
    id: string;
    retailPrice: number;
    actualPrice?: number;
    marketPrice?: number;
    validFrom: string;
    validTo?: string;
  }>;
  recentOrders: Array<{
    orderId: string;
    orderDate: string;
    customerName: string;
    quantity: number;
    priceAtOrder: number;
    status: string;
  }>;
  totalStock: number;
  currentPrice: number;
  currentActualPrice?: number;
  currentMarketPrice?: number;
  lowStockThreshold: number;
};

export default function ProductDetailPage() {
  const router = useRouter();
  const { productId } = useParams<{ productId: string }>();
  const { selectedOrgId, orgs } = useOrgStore();
  const { getToken } = useAuth();

  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStockTransferOpen, setIsStockTransferOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageUpdateTrigger, setImageUpdateTrigger] = useState(0);
  const [productNotFound, setProductNotFound] = useState(false);

  const pricing = useMemo(() => {
    if (!product) return { retail: 0, actual: 0, market: 0 };
    const latest = product.priceHistory[0];
    return {
      retail: product.currentPrice,
      actual: product.currentActualPrice ?? latest?.actualPrice ?? 0,
      market: product.currentMarketPrice ?? latest?.marketPrice ?? 0,
    };
  }, [product]);

  const role = useCurrentOrgRole();

  const isRoleLoaded = role !== undefined;
  const isEmployee = role === "employee";

  const canEdit = isRoleLoaded && !isEmployee;
  const canDelete = isRoleLoaded && !isEmployee;
  const canManageStatus = isRoleLoaded && !isEmployee;
  const canTransferStock = isRoleLoaded && !isEmployee;
  const canEditImage = isRoleLoaded && !isEmployee;

  const metrics = useMemo(() => {
    const profitMargin =
      pricing.actual > 0
        ? ((pricing.retail - pricing.actual) / pricing.retail) * 100
        : 0;
    const competitive =
      pricing.market > 0
        ? ((pricing.market - pricing.retail) / pricing.market) * 100
        : 0;
    return { profitMargin, competitive };
  }, [pricing]);

  const stockBadge = useMemo(() => {
    if (!product) return { label: "Loading", variant: "default" as const };
    const s = product.totalStock;
    const t = product.lowStockThreshold;
    if (s === 0)
      return { label: "Out of stock", variant: "destructive" as const };
    if (s < t) return { label: "Low stock", variant: "warning" as const };
    if (s < t * 2) return { label: "Moderate", variant: "default" as const };
    return { label: "In stock", variant: "default" as const };
  }, [product]);

  const fetchAll = useCallback(
    async (showLoading = true) => {
      if (!selectedOrgId || !productId) return;

      if (showLoading) setIsLoading(true);
      setError(null);
      setProductNotFound(false);

      try {
        const [p, w] = await Promise.all([
          getProductDetails(selectedOrgId, productId as string),
          getWarehousesWithStock(selectedOrgId, productId as string),
        ]);
        setProduct(p);
        setWarehouses(w || []);
      } catch (e: any) {
        const msg = e?.message || "Failed to load product";

        // Check if product doesn't exist (handles deleted products)
        if (
          msg.includes("not found") ||
          msg.includes("Product not found") ||
          msg.includes("Cannot convert")
        ) {
          setProductNotFound(true);
          toast.error("Product not found. It may have been deleted.");

          // Redirect immediately
          setTimeout(() => {
            router.push("/inventory");
          }, 1500);
        } else {
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [selectedOrgId, productId, router],
  );

  const handleStatusUpdate = useCallback(
    async (status: "active" | "inactive" | "discontinued") => {
      if (!selectedOrgId || !productId) return;

      try {
        await updateProductStatus(selectedOrgId, productId as string, status);
        await fetchAll(false); // Refresh data
        toast.success(
          `Product ${
            status === "active"
              ? "activated"
              : status === "inactive"
                ? "deactivated"
                : "discontinued"
          } successfully`,
        );
      } catch (e: any) {
        toast.error(e?.message || "Status update failed");
      }
    },
    [selectedOrgId, productId, fetchAll],
  );

  const handleActivate = useCallback(async () => {
    if (!selectedOrgId || !productId) return;

    try {
      await activateProduct(selectedOrgId, productId as string);
      await fetchAll(false);
      toast.success("Product activated successfully");
    } catch (e: any) {
      toast.error(e?.message || "Activation failed");
    }
  }, [selectedOrgId, productId, fetchAll]);

  // Add image update handler
  const handleImageUpdate = useCallback(
    async (imageUrl: string) => {
      if (!selectedOrgId || !productId) return;

      try {
        await updateProductDetails(selectedOrgId, productId as string, {
          image: imageUrl,
        });
        setImageUpdateTrigger((prev) => prev + 1); // Trigger re-render

        if (product) {
          setProduct((prev) => (prev ? { ...prev, image: imageUrl } : null));
        }
      } catch (e: any) {
        toast.error(e?.message || "Image update failed");
      }
    },
    [selectedOrgId, productId, product],
  );

  const handleDelete = useCallback(
    async (force: boolean = false) => {
      if (!selectedOrgId || !productId) return;

      try {
        if (force) {
          await deactivateProduct(selectedOrgId, productId as string);
          toast.success("Product deactivated successfully");
        }

        // CRITICAL: Invalidate router cache and redirect immediately
        router.refresh();

        // Redirect without delay since product is gone
        router.push("/inventory");
      } catch (e: any) {
        const errorMessage = e?.message || "Operation failed";

        if (errorMessage.includes("has been ordered")) {
          toast.error(errorMessage, {
            duration: 8000,
            action: {
              label: "Deactivate Instead",
              onClick: () => handleDelete(true),
            },
          });
        } else {
          toast.error(errorMessage);
        }
      } finally {
        setDeleteDialogOpen(false);
      }
    },
    [selectedOrgId, productId, router],
  );

  const onSave = useCallback(
    async (data: any) => {
      if (!selectedOrgId || !productId) return;

      try {
        await updateProductDetails(selectedOrgId, productId as string, data);

        // CRITICAL: Refresh router cache
        router.refresh();

        // Refresh data
        await fetchAll(false);
        setIsEditDialogOpen(false);
        toast.success("Product updated");
      } catch (e: any) {
        toast.error(e?.message || "Update failed");
      }
    },
    [selectedOrgId, productId, fetchAll, router],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) await fetchAll(true);
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAll]);

  const onDelete = useCallback(async () => {
    if (!selectedOrgId || !productId) return;
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await deleteProductDetails(selectedOrgId, productId as string);
      toast.success("Product deleted");
      window.location.href = "/inventory";
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }, [selectedOrgId, productId]);

  if (orgs.length === 0 || !selectedOrgId) {
    return (
      <OrganizationState
        hasOrganizations={orgs.length > 0}
        hasSelectedOrg={!!selectedOrgId}
        orgs={orgs}
        selectedOrgId={selectedOrgId}
        onOrganizationSelect={(id) =>
          useOrgStore.getState().setSelectedOrgId(id)
        }
      />
    );
  }

  if (productNotFound) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex-1 grid place-items-center p-6">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <CardTitle className="mb-2">Product Not Found</CardTitle>
            <CardDescription className="mb-4">
              This product may have been deleted or you don't have permission to
              view it.
            </CardDescription>
            <Button onClick={() => router.push("/inventory")}>
              Return to Inventory
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-4 md:p-8 pt-6">
          <div className="flex items-center justify-between">
            <Link href="/inventory" prefetch>
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Inventory
              </Button>
            </Link>
            {product && (
              <div className="flex items-center gap-2">
                {canTransferStock && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setIsStockTransferOpen(true)}
                  >
                    <Warehouse className="h-4 w-4" />
                    Transfer Stock
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                )}

                {/* Status Management Dropdown */}
                {canManageStatus && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        {product.status === "active" ? (
                          <Power className="h-4 w-4 text-green-600" />
                        ) : product.status === "inactive" ? (
                          <PowerOff className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <Archive className="h-4 w-4 text-red-600" />
                        )}
                        Status
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {product.status !== "active" && (
                        <DropdownMenuItem
                          onClick={() => handleStatusUpdate("active")}
                          className="gap-2"
                        >
                          <Power className="h-4 w-4 text-green-600" />
                          Activate Product
                        </DropdownMenuItem>
                      )}
                      {product.status !== "inactive" && (
                        <DropdownMenuItem
                          onClick={() => handleStatusUpdate("inactive")}
                          className="gap-2"
                        >
                          <PowerOff className="h-4 w-4 text-yellow-600" />
                          Deactivate Product
                        </DropdownMenuItem>
                      )}
                      {product.status !== "discontinued" && (
                        <DropdownMenuItem
                          onClick={() => handleStatusUpdate("discontinued")}
                          className="gap-2"
                        >
                          <Archive className="h-4 w-4 text-red-600" />
                          Discontinue Product
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {}
                      <DropdownMenuItem
                        onClick={() => handleDelete(true)}
                        className="gap-2 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Product
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  {canDelete && (
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                  )}
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Product</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          Are you sure you want to delete{" "}
                          <strong>{product.name}</strong>?
                        </p>
                        <p className="text-sm text-muted-foreground">
                          This action cannot be undone. If this product has been
                          ordered before, consider discontinuing it instead of
                          deleting it.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(false)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Product
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <ProductHeaderSkeleton className="xl:col-span-2" />
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {product && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-2xl">
                          {product.name}
                        </CardTitle>
                        <CardDescription className="text-base">
                          SKU: {product.sku}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{stockBadge.label}</Badge>
                        <Badge variant="outline" className="capitalize">
                          {product.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg">
                        <Package className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold">
                          {product.totalStock.toLocaleString()}
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-300">
                          Total Stock
                        </div>
                      </div>

                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg">
                        <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <div className="text-2xl font-bold">
                          ${pricing.retail.toFixed(2)}
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-300">
                          Retail Price
                        </div>
                      </div>

                      <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 rounded-lg">
                        <TrendingDown className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                        <div className="text-2xl font-bold">
                          ${pricing.actual.toFixed(2)}
                        </div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-300">
                          Actual Cost
                        </div>
                      </div>

                      <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 rounded-lg">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                        <div className="text-2xl font-bold">
                          ${pricing.market.toFixed(2)}
                        </div>
                        <div className="text-sm text-indigo-600 dark:text-indigo-300">
                          Market Price
                        </div>
                      </div>

                      <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-lg">
                        <Percent className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                        <div className="text-2xl font-bold">
                          {metrics.profitMargin.toFixed(1)}%
                        </div>
                        <div className="text-sm text-emerald-600 dark:text-emerald-300">
                          Profit Margin
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ProductImageCard
                  product={{
                    name: product.name,
                    image: product.image,
                    id: product.id,
                  }}
                  onImageUpdate={async (imageUrl: string) => {
                    try {
                      // Upload to org storage if we have a SKU and org
                      if (product.sku && selectedOrgId) {
                        const token = await getToken();
                        if (token) {
                          const org = orgs.find(
                            (o) => String(o.id) === String(selectedOrgId),
                          );
                          if (org) {
                            const { productImagesFolderId } =
                              await StorageApi.ensureOrgFolder(
                                token,
                                String(org.id),
                                org.name,
                              );
                            const response = await fetch(imageUrl);
                            const blob = await response.blob();
                            const file = new File(
                              [blob],
                              `${product.sku}.jpg`,
                              { type: blob.type },
                            );
                            await StorageApi.uploadInventoryImage(
                              token,
                              file,
                              String(org.id),
                              product.sku,
                              productImagesFolderId,
                            );
                          }
                        }
                      }

                      await updateProductDetails(selectedOrgId!, productId!, {
                        image: imageUrl,
                      });
                      toast.success("Image uploaded successfully");
                    } catch (error) {
                      console.error("Image update error:", error);
                      toast.error("Image update failed");
                    }
                  }}
                  editable={canEditImage}
                  orgId={selectedOrgId!}
                />
              </div>

              <Card>
                <CardContent className="p-6">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
                      <TabsTrigger value="pricing">Pricing</TabsTrigger>
                      <TabsTrigger value="orders">Orders</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6 mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Info className="h-5 w-5" />
                              Product Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">
                                  Product ID
                                </p>
                                <p className="text-sm text-muted-foreground font-mono">
                                  {product.id}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">SKU</p>
                                <p className="text-sm text-muted-foreground font-mono">
                                  {product.sku}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Status</p>
                                <Badge variant="outline" className="capitalize">
                                  {product.status}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">
                                  Low Stock Alert
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {product.lowStockThreshold} units
                                </p>
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Description</p>
                              <ScrollArea className="h-20">
                                <p className="text-sm text-muted-foreground">
                                  {product.description ||
                                    "No description available"}
                                </p>
                              </ScrollArea>
                            </div>
                          </CardContent>
                        </Card>

                        {activeTab === "overview" && (
                          <Suspense
                            fallback={
                              <div className="h-[300px] rounded bg-muted animate-pulse" />
                            }
                          >
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">
                                  Stock Distribution
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <StockDistributionChart
                                  data={product.warehouses.map((w) => ({
                                    name: w.name ?? "Unknown Warehouse",
                                    stock: w.stock,
                                  }))}
                                />
                              </CardContent>
                            </Card>
                          </Suspense>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="warehouses" className="space-y-6 mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {product.warehouses.map((w) => (
                          <Card key={w.id}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">
                                {w.name}
                              </CardTitle>
                              {w.address && (
                                <p className="text-sm text-muted-foreground">
                                  {w.address}
                                </p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  Stock:
                                </span>
                                <span className="font-bold">
                                  {w.stock} units
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="pricing" className="space-y-6 mt-6">
                      {activeTab === "pricing" && (
                        <Suspense
                          fallback={
                            <div className="h-[400px] rounded bg-muted animate-pulse" />
                          }
                        >
                          <PriceHistoryChart data={product.priceHistory} />
                        </Suspense>
                      )}
                    </TabsContent>

                    <TabsContent value="orders" className="space-y-6 mt-6">
                      {activeTab === "orders" && (
                        <>
                          <Suspense
                            fallback={
                              <div className="h-[300px] rounded bg-muted animate-pulse" />
                            }
                          >
                            <OrderTrendChart data={product.recentOrders} />
                          </Suspense>
                          <Suspense
                            fallback={
                              <div className="h-[200px] rounded bg-muted animate-pulse" />
                            }
                          >
                            <RecentOrdersTable orders={product.recentOrders} />
                          </Suspense>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}

          {isEditDialogOpen && product && (
            <Suspense fallback={<div>Loading...</div>}>
              <EditProductDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onSave={onSave}
                initialData={{
                  ...product,
                  actualPrice: pricing.actual,
                  marketPrice: pricing.market,
                }}
              />
            </Suspense>
          )}

          {isStockTransferOpen && (
            <Suspense fallback={<div>Loading...</div>}>
              <StockTransferDialog
                open={isStockTransferOpen}
                onOpenChange={setIsStockTransferOpen}
                productId={productId as string}
                orgId={selectedOrgId!}
                warehouses={warehouses}
                onSuccess={() => fetchAll(false)}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
