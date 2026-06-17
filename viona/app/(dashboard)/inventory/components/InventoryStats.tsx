import { Card } from "@/components/ui/card";
import { 
  Package, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle,
} from "lucide-react";
import type { Product } from "@/app/api/inventory/products/route";

interface InventoryStatsProps {
  products: Product[];
}

export function InventoryStats({ products }: InventoryStatsProps) {
  const totalProducts = products.length;
  const totalStock = products.reduce((acc, product) => acc + product.stock, 0);
  const totalValue = products.reduce((acc, product) => acc + (product.stock * product.price), 0);
  
  const lowStockCount = products.filter(product => product.stock < 10 && product.stock > 0).length;
  const outOfStockCount = products.filter(product => product.stock === 0).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const stats = [
    {
      title: "Total Products",
      value: totalProducts.toLocaleString(),
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Total Inventory Value",
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Total Items in Stock",
      value: totalStock.toLocaleString(),
      icon: CheckCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      title: "Low / Out of Stock",
      value: `${lowStockCount} / ${outOfStockCount}`,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <IconComponent className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
