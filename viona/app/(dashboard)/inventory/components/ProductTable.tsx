"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddProductDialog } from "./AddProductDialog";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { Edit, Trash2, Eye, Loader2 } from "lucide-react";
import type { Product } from "@/app/api/inventory/products/route";
import { useOrgStore } from "@/hooks/useOrgStore";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductTableProps {
  products: Product[];
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (
    id: string,
    product: Omit<Product, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  isLoading?: boolean;
  isEmployee: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

// RBAC-aware row component
const ProductRow = memo(
  ({
    product,
    onEdit,
    onDeleteClick,
    canEdit,
    canDelete,
    isSelected,
    onCheck,
  }: {
    product: Product;
    onEdit: (product: Product) => void;
    onDeleteClick: (product: Product) => void;
    canEdit: boolean;
    canDelete: boolean;
    isSelected: boolean;
    onCheck: (checked: boolean) => void;
  }) => {
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(price);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    const stockStatus = useMemo(() => {
      if (product.stock === 0)
        return { label: "Out of Stock", variant: "secondary" as const };
      if (product.stock < 10)
        return { label: "Low Stock", variant: "destructive" as const };
      return { label: "In Stock", variant: "default" as const };
    }, [product.stock]);

    return (
      <TableRow>
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onCheck}
            aria-label={`Select product ${product.name}`}
          />
        </TableCell>
        <TableCell>
          <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  if (target.parentElement) {
                    target.parentElement.innerHTML =
                      '<div class="text-xs text-muted-foreground">No Image</div>';
                  }
                }}
              />
            ) : (
              <div className="text-xs text-muted-foreground">No Image</div>
            )}
          </div>
        </TableCell>
        <TableCell className="font-medium">
          <div className="max-w-[200px] truncate" title={product.name}>
            {product.name}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground font-mono text-sm">
          {product.sku}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="min-w-[20px] font-medium">{product.stock}</span>
            {product.stock < 10 && product.stock > 0 && (
              <Badge variant="destructive" className="text-xs">
                Low
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="font-medium">
          {formatPrice(product.price)}
        </TableCell>
        <TableCell>
          <Badge
            variant={stockStatus.variant}
            className={
              product.stock > 0
                ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100"
                : ""
            }
          >
            {stockStatus.label}
          </Badge>
        </TableCell>
        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
          {formatDate(product.createdAt)}
        </TableCell>
        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
          {formatDate(product.updatedAt)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {/* View - Always visible to all roles */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/inventory/${product.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>View details</TooltipContent>
            </Tooltip>

            {/* Edit - Only visible to admin/manager, NOT to employees */}
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(product)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit product</TooltipContent>
              </Tooltip>
            )}

            {/* Delete - Only visible to admin/manager, NOT to employees */}
            {canDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteClick(product)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete product</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  }
);

ProductRow.displayName = "ProductRow";

export function ProductTable({
  products,
  onDelete,
  onUpdate,
  isLoading = false,
  isEmployee,
  selectedIds,
  onSelectionChange,
}: ProductTableProps) {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canEdit = !!onUpdate && !isEmployee;
  const canDelete = !!onDelete && !isEmployee;



  const handleEdit = (product: Product) => {
    if (!canEdit || isEmployee) return; // Double guard
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    if (!canDelete || isEmployee) return; // Double guard
    setDeleteProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteProduct && onDelete && !isEmployee) {
      await onDelete(deleteProduct.id);
      setDeleteProduct(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleUpdateProduct = async (
    updatedProduct: Omit<Product, "id" | "createdAt" | "updatedAt">
  ) => {
    if (editingProduct && onUpdate && !isEmployee) {
      await onUpdate(editingProduct.id, updatedProduct);
      setEditingProduct(null);
      setIsEditDialogOpen(false);
    }
  };

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const indeterminate = selectedIds.size > 0 && selectedIds.size < products.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(products.map(p => p.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    onSelectionChange(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden relative">
        {isLoading && (
          <div className="absolute top-2 right-4 flex items-center gap-2 text-sm text-muted-foreground z-20">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating...</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        // @ts-ignore
                        indeterminate={indeterminate ? "true" : undefined}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all products"
                      />
                    </TableHead>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Created
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Modified
                    </TableHead>
                    <TableHead className="text-right w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      onEdit={handleEdit}
                      onDeleteClick={handleDeleteClick}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      isSelected={selectedIds.has(product.id)}
                      onCheck={(checked) => handleSelectRow(product.id, checked)}
                    />
                  ))}
                </TableBody>
          </Table>
        </div>

        {products.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No products found. Try adjusting your filters or add your first product.
          </div>
        )}
      </Card>

      {/* Edit Dialog - Only render if NOT employee */}
      {!isEmployee && canEdit && (
        <AddProductDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setEditingProduct(null);
          }}
          onSave={handleUpdateProduct}
          product={editingProduct}
          orgId={selectedOrgId || ""}
          mode="edit"
        />
      )}

      {/* Delete Dialog - Only render if NOT employee */}
      {!isEmployee && canDelete && (
        <DeleteConfirmationDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          product={deleteProduct}
        />
      )}
    </TooltipProvider>
  );
}