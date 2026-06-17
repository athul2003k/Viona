"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Warehouse as WarehouseIcon,
  Package,
  MapPin,
  Edit,
  Trash2,
  ChevronRight
} from "lucide-react";
import type { Warehouse } from "../../../api/warehouses/route";
import { EditWarehouseDialog } from "./EditWarehouseDialog";
import { DeleteWarehouseDialog } from "./DeleteWarehouseDialog";
import { useRouter } from "next/navigation";
import { useCurrentOrgRole } from "@/hooks/useOrgStore";


type Props = {
  warehouses: Warehouse[];
  onRefresh: () => Promise<void>;
  orgId: string;
};

export function WarehouseGrid({ warehouses, onRefresh, orgId }: Props) {
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const router = useRouter();

  const role = useCurrentOrgRole();
  const isRoleLoaded = role !== undefined;

  const isAdmin = role === "admin";

  // RBAC
  const canEditWarehouse = isRoleLoaded && isAdmin;
  const canDeleteWarehouse = isRoleLoaded && isAdmin;


  const handleViewDetails = (warehouseId: string) => {
    router.push(`/warehouse/${warehouseId}?orgId=${orgId}`);
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((warehouse) => (
          <Card
            key={warehouse.id}
            className="hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => handleViewDetails(warehouse.id)}
          >
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <WarehouseIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{warehouse.name}</h3>
                    {warehouse.isDefault && (
                      <Badge variant="secondary" className="mt-1">
                        Default
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{warehouse.address}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Products</p>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{warehouse.productCount}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Stock</p>
                  <span className="font-semibold text-lg">{warehouse.totalStock.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>

            {(canEditWarehouse || canDeleteWarehouse) && (
              <CardFooter className="pt-4 flex gap-2">
                {canEditWarehouse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWarehouse(warehouse);
                    }}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}

                {canDeleteWarehouse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingWarehouse(warehouse);
                    }}
                    className="flex-1"
                    disabled={warehouse.isDefault}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </CardFooter>
            )}

          </Card>
        ))}
      </div>

      {editingWarehouse && (
        <EditWarehouseDialog
          open={!!editingWarehouse}
          onOpenChange={(open) => !open && setEditingWarehouse(null)}
          warehouse={editingWarehouse}
          onSuccess={onRefresh}
          orgId={orgId}
        />
      )}

      {deletingWarehouse && (
        <DeleteWarehouseDialog
          open={!!deletingWarehouse}
          onOpenChange={(open) => !open && setDeletingWarehouse(null)}
          warehouse={deletingWarehouse}
          onSuccess={onRefresh}
          orgId={orgId}
        />
      )}
    </>
  );
}
