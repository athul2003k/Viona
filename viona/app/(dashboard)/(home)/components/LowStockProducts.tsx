import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Product {
    id: string;
    name: string;
    sku: string;
    quantity: number;
}

interface LowStockProductsProps {
    products: Product[];
}

export function LowStockProducts({ products }: LowStockProductsProps) {
    return (
        <Card className="col-span-1 shadow-sm border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">Low Stock Alerts</CardTitle>
                <div className="p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
            </CardHeader>
            <CardContent>
                {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed rounded-lg mt-2">
                        <AlertTriangle className="h-6 w-6 text-emerald-500 mb-2 opacity-50" />
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">All stock levels</p>
                        <p className="text-xs text-muted-foreground">look good!</p>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {products.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 hover:bg-destructive/5 rounded-lg transition-colors border border-transparent hover:border-destructive/10">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold leading-none">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">SKU: <span className="font-mono bg-muted px-1 py-0.5 rounded">{p.sku}</span></p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="text-lg font-bold text-destructive leading-none">
                                        {p.quantity}
                                    </div>
                                    <div className="text-[10px] text-destructive/80 font-medium uppercase mt-1">
                                        left
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
