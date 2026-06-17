"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Warehouse, Package, TrendingUp, Building2 } from "lucide-react";
import type { Warehouse as WarehouseType } from "../../../api/warehouses/route";

type Props = {
  warehouses: WarehouseType[];
};

export function WarehouseStats({ warehouses }: Props) {
  const totalWarehouses = warehouses.length;
  const totalProducts = warehouses.reduce((sum, w) => sum + w.productCount, 0);
  const totalStock = warehouses.reduce((sum, w) => sum + w.totalStock, 0);
  const avgStockPerWarehouse = totalWarehouses > 0 
    ? Math.round(totalStock / totalWarehouses) 
    : 0;

  const stats = [
    {
      label: "Total Warehouses",
      value: totalWarehouses,
      icon: Warehouse,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      label: "Unique Products",
      value: totalProducts,
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
    {
      label: "Total Stock",
      value: totalStock.toLocaleString(),
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
    {
      label: "Avg Stock/Warehouse",
      value: avgStockPerWarehouse.toLocaleString(),
      icon: Building2,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
