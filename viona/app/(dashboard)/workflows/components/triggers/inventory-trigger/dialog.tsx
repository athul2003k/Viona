"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const InventoryTriggerDialog = ({ open, onOpenChange }: Props) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Inventory Trigger</DialogTitle>
                    <DialogDescription>
                        This trigger fires automatically when a product, stock level, or pricing is created, updated, or deleted in your organization.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="rounded-lg p-4 bg-muted space-y-2">
                        <h4 className="font-medium text-sm">How it works</h4>
                        <p className="text-sm text-muted-foreground">
                            No configuration needed. This trigger is auto-configured and monitors all inventory changes (products, stock quantities, and pricing) for your organization.
                        </p>
                    </div>
                    <div className="rounded-lg p-4 bg-muted space-y-2">
                        <h4 className="font-medium text-sm">Available Variables</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{inventory.action}}"}
                                </code>
                                {" — "}create, update, or delete
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{inventory.model}}"}
                                </code>
                                {" — "}Product, ProductStock, or ProductPrice
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{inventory.productId}}"}
                                </code>
                                {" — "}The affected product ID
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{inventory.productName}}"}
                                </code>
                                {" — "}Product name (when available)
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{inventory.sku}}"}
                                </code>
                                {" — "}Product SKU (when available)
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{json inventory}}"}
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
