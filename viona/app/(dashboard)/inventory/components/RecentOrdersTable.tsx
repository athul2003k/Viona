"use client";

import { memo } from "react";
import { Card } from "@/components/ui/card";

type Order = {
  orderId: string;
  orderDate: string;
  customerName: string;
  quantity: number;
  priceAtOrder: number;
  status: string;
};

function TableInner({ orders }: { orders: Order[] }) {
  return (
    <Card className="p-4">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left sticky top-0 bg-background">
            <tr>
              <th className="py-2 pr-4">Order ID</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Price</th>
              <th className="py-2 pr-0">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.orderId} className="border-t">
                <td className="py-2 pr-4 font-mono">{o.orderId}</td>
                <td className="py-2 pr-4">{new Date(o.orderDate).toLocaleDateString()}</td>
                <td className="py-2 pr-4">{o.customerName}</td>
                <td className="py-2 pr-4">{o.quantity}</td>
                <td className="py-2 pr-4">${o.priceAtOrder.toFixed(2)}</td>
                <td className="py-2 pr-0 capitalize">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default memo(TableInner);
