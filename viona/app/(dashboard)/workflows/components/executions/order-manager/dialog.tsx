"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Order Manager is auto-configured — queries the org's own database
export type OrderManagerFormValues = Record<string, never>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const OrderManagerDialog = ({ open, onOpenChange }: Props) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Order Manager Tool</DialogTitle>
                    <DialogDescription>
                        Auto-configured. The AI agent can search, view, and update orders in your organization.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">Available Actions</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Search orders by customer, status, or date</li>
                        <li>View order details and items</li>
                        <li>Update order status</li>
                        <li>Get order statistics and summaries</li>
                    </ul>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">🔐 Scoped to your organization</p>
                    <p className="text-xs mt-1 opacity-80">Can update order status only. Cannot delete orders or modify amounts.</p>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
