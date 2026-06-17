"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const OrderTriggerDialog = ({ open, onOpenChange }: Props) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Order Trigger</DialogTitle>
                    <DialogDescription>
                        This trigger fires automatically when an order or order item is created, updated, or deleted in your organization.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="rounded-lg p-4 bg-muted space-y-2">
                        <h4 className="font-medium text-sm">How it works</h4>
                        <p className="text-sm text-muted-foreground">
                            No configuration needed. This trigger is auto-configured and monitors all order changes (orders and order items) for your organization.
                        </p>
                    </div>
                    <div className="rounded-lg p-4 bg-muted space-y-2">
                        <h4 className="font-medium text-sm">Available Variables</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{order.action}}"}
                                </code>
                                {" — "}create, update, or delete
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{order.model}}"}
                                </code>
                                {" — "}Order or OrderItem
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{order.orderId}}"}
                                </code>
                                {" — "}The affected order ID
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{order.status}}"}
                                </code>
                                {" — "}Order status (when available)
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{order.customerName}}"}
                                </code>
                                {" — "}Customer name (when available)
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{order.total}}"}
                                </code>
                                {" — "}Order total amount
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{json order}}"}
                                </code>
                                {" — "}Full event data as JSON
                            </li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
