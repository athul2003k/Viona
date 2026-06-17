import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "lucide-react";

interface Order {
    id: string;
    customer: string;
    status: string;
    amount: number;
    date: string;
}

interface RecentOrdersProps {
    orders: Order[];
}

export function RecentOrders({ orders }: RecentOrdersProps) {
    return (
        <Card className="col-span-1 shadow-sm border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground mb-2 opacity-20" />
                        <p className="text-sm text-muted-foreground">No orders found.</p>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {orders.map(o => (
                            <div key={o.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold leading-none">{o.customer}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(o.date), { addSuffix: true })}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <p className="text-sm font-bold text-primary">
                                        ${o.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                    <Badge
                                        variant={
                                            o.status.toLowerCase() === 'delivered' ? 'default' :
                                                o.status.toLowerCase() === 'pending' ? 'secondary' : 'outline'
                                        }
                                        className={`capitalize text-[10px] px-2 py-0 h-4 ${o.status.toLowerCase() === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 shadow-none border-0' : o.status.toLowerCase() === 'pending' ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 shadow-none border-0' : ''}`}
                                    >
                                        {o.status.toLowerCase()}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
