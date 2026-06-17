import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers2Icon, Logs, Package, DollarSign } from "lucide-react";

interface SummaryCardsProps {
    stats: {
        workflows: number;
        orders: number;
        products: number;
        revenue: number;
    };
}

export function SummaryCards({ stats }: SummaryCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm transition-all hover:shadow-md border-primary/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Revenue
                    </CardTitle>
                    <div className="p-2 bg-emerald-500/10 rounded-full">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold tracking-tight">
                        ${stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm transition-all hover:shadow-md border-primary/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Active Workflows
                    </CardTitle>
                    <div className="p-2 bg-blue-500/10 rounded-full">
                        <Layers2Icon className="h-4 w-4 text-blue-500" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold tracking-tight">+{stats.workflows}</div>
                </CardContent>
            </Card>
            <Card className="shadow-sm transition-all hover:shadow-md border-primary/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Orders
                    </CardTitle>
                    <div className="p-2 bg-purple-500/10 rounded-full">
                        <Logs className="h-4 w-4 text-purple-500" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold tracking-tight">+{stats.orders}</div>
                </CardContent>
            </Card>
            <Card className="shadow-sm transition-all hover:shadow-md border-primary/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Products
                    </CardTitle>
                    <div className="p-2 bg-orange-500/10 rounded-full">
                        <Package className="h-4 w-4 text-orange-500" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold tracking-tight">+{stats.products}</div>
                </CardContent>
            </Card>
        </div>
    );
}
