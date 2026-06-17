"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Inventory Lookup is auto-configured — queries the org's own database
export type InventoryLookupFormValues = Record<string, never>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const InventoryLookupDialog = ({ open, onOpenChange }: Props) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Inventory Lookup Tool</DialogTitle>
                    <DialogDescription>
                        Auto-configured. The AI agent can query your organization&apos;s products, stock levels, and warehouse data.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">Available Actions</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Search products by name or SKU</li>
                        <li>Check stock levels at warehouses</li>
                        <li>Get product pricing details</li>
                        <li>List all warehouses</li>
                    </ul>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">🔒 Read-only access</p>
                    <p className="text-xs mt-1 opacity-80">This tool can only read inventory data. It cannot modify products or stock levels.</p>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
