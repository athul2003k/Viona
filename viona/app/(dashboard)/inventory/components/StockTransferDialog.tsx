"use client";

import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, ArrowRight, Package, Warehouse, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { transferStock, getWarehousesWithStock } from "@/app/(dashboard)/inventory/actions";

interface WarehouseOption {
  id: string;
  name: string;
  address?: string;
  currentStock?: number;
}

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  orgId: string;
  warehouses?: WarehouseOption[]; // Make optional - we'll fetch if needed
  onSuccess: () => void;
}

const TRANSFER_REASONS = [
  { value: "rebalancing", label: "Stock Rebalancing" },
  { value: "demand", label: "High Demand Location" },
  { value: "consolidation", label: "Inventory Consolidation" },
  { value: "maintenance", label: "Warehouse Maintenance" },
  { value: "optimization", label: "Space Optimization" },
  { value: "emergency", label: "Emergency Supply" },
  { value: "other", label: "Other" },
] as const;

function StockTransferDialogComponent({ 
  open, 
  onOpenChange, 
  productId, 
  orgId, 
  warehouses: initialWarehouses,
  onSuccess 
}: StockTransferDialogProps) {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>(initialWarehouses || []);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch warehouses with stock when dialog opens if not provided
  useEffect(() => {
    if (open && (!initialWarehouses || initialWarehouses.length === 0)) {
      fetchWarehouses();
    } else if (open && initialWarehouses) {
      setWarehouses(initialWarehouses);
    }
  }, [open, initialWarehouses]);

  const fetchWarehouses = async () => {
    setIsLoadingWarehouses(true);
    setError(null);
    try {
      const data = await getWarehousesWithStock(orgId, productId);
      console.log("Fetched warehouses with stock:", data);
      setWarehouses(data);
      
      if (data.length === 0) {
        setError("No warehouses available for this organization");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load warehouses";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingWarehouses(false);
    }
  };

  // Memoized warehouse data
  const sourceWarehouse = useMemo(() => 
    warehouses.find(w => w.id === fromWarehouse), 
    [warehouses, fromWarehouse]
  );
  
  const destinationWarehouse = useMemo(() => 
    warehouses.find(w => w.id === toWarehouse), 
    [warehouses, toWarehouse]
  );
  
  const maxQuantity = useMemo(() => 
    sourceWarehouse?.currentStock ?? 0, 
    [sourceWarehouse]
  );

  const availableDestinations = useMemo(() => 
    warehouses.filter(w => w.id !== fromWarehouse), 
    [warehouses, fromWarehouse]
  );

  // Parse quantity
  const quantityNum = useMemo(() => {
    const parsed = parseInt(quantity);
    return isNaN(parsed) ? 0 : parsed;
  }, [quantity]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFromWarehouse("");
      setToWarehouse("");
      setQuantity("");
      setReason("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  // Reset destination if it becomes invalid
  useEffect(() => {
    if (toWarehouse && toWarehouse === fromWarehouse) {
      setToWarehouse("");
    }
  }, [fromWarehouse, toWarehouse]);

  // Form validation
  const validateForm = useCallback((): string | null => {
    if (!fromWarehouse || !toWarehouse) {
      return "Please select both source and destination warehouses";
    }
    
    if (fromWarehouse === toWarehouse) {
      return "Source and destination warehouses must be different";
    }
    
    if (!quantity || quantityNum <= 0) {
      return "Please enter a valid quantity greater than 0";
    }
    
    if (quantityNum > maxQuantity) {
      return `Insufficient stock. Available: ${maxQuantity} units`;
    }
    
    if (!reason || !reason.trim()) {
      return "Please select a reason for the transfer";
    }
    
    return null;
  }, [fromWarehouse, toWarehouse, quantity, quantityNum, maxQuantity, reason]);

  const handleTransfer = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      console.log("Transferring stock:", {
        orgId,
        productId,
        fromWarehouse,
        toWarehouse,
        quantity: quantityNum,
        reason,
      });

      await transferStock(
        orgId, 
        productId, 
        fromWarehouse, 
        toWarehouse, 
        quantityNum, 
        reason, 
        notes.trim() || undefined
      );
      
      toast.success(`Successfully transferred ${quantityNum} units from ${sourceWarehouse?.name} to ${destinationWarehouse?.name}`);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to transfer stock";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Stock transfer error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, orgId, productId, fromWarehouse, toWarehouse, quantityNum, reason, notes, onSuccess, onOpenChange, sourceWarehouse, destinationWarehouse]);

  const isFormValid = useMemo(() => 
    fromWarehouse && 
    toWarehouse && 
    quantityNum > 0 && 
    quantityNum <= maxQuantity && 
    reason.trim().length > 0, 
    [fromWarehouse, toWarehouse, quantityNum, maxQuantity, reason]
  );

  // Show loading state while fetching warehouses
  if (isLoadingWarehouses) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col items-center justify-center p-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading warehouses...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error if no warehouses
  if (warehouses.length === 0 && !isLoadingWarehouses) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              No Warehouses Available
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || "No warehouses found for this organization. Please create a warehouse first."}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfer Stock Between Warehouses
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Transfer Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Source Warehouse */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  From
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select 
                  value={fromWarehouse} 
                  onValueChange={(value) => {
                    console.log("From warehouse selected:", value);
                    setFromWarehouse(value);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No warehouses available</div>
                    ) : (
                      warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                          {typeof warehouse.currentStock === 'number' && ` (${warehouse.currentStock} units)`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {sourceWarehouse && (
                  <div className="text-sm text-muted-foreground space-y-1 p-2 bg-muted/50 rounded-lg border">
                    <p className="font-medium text-foreground">{sourceWarehouse.name}</p>
                    {sourceWarehouse.address && (
                      <p className="text-xs">{sourceWarehouse.address}</p>
                    )}
                    {typeof sourceWarehouse.currentStock === 'number' && (
                      <div className="flex items-center gap-1 pt-1">
                        <Package className="h-3 w-3" />
                        <p className="text-xs font-medium text-green-600 dark:text-green-400">
                          Available: {sourceWarehouse.currentStock} units
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transfer Arrow & Quantity */}
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      setError(null);
                    }}
                    disabled={isSubmitting || !fromWarehouse}
                    className="w-28 text-center font-semibold"
                    min="1"
                    max={maxQuantity}
                  />
                  {fromWarehouse && (
                    <p className="text-xs text-muted-foreground">
                      Max: <span className="font-medium">{maxQuantity}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Destination Warehouse */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  To
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select 
                  value={toWarehouse} 
                  onValueChange={(value) => {
                    console.log("To warehouse selected:", value);
                    setToWarehouse(value);
                    setError(null);
                  }}
                  disabled={isSubmitting || !fromWarehouse}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDestinations.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        {fromWarehouse ? "No other warehouses available" : "Select source first"}
                      </div>
                    ) : (
                      availableDestinations.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                          {typeof warehouse.currentStock === 'number' && ` (${warehouse.currentStock} units)`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {destinationWarehouse && (
                  <div className="text-sm text-muted-foreground space-y-1 p-2 bg-muted/50 rounded-lg border">
                    <p className="font-medium text-foreground">{destinationWarehouse.name}</p>
                    {destinationWarehouse.address && (
                      <p className="text-xs">{destinationWarehouse.address}</p>
                    )}
                    {typeof destinationWarehouse.currentStock === 'number' && (
                      <div className="flex items-center gap-1 pt-1">
                        <Package className="h-3 w-3" />
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          Current: {destinationWarehouse.currentStock} units
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Transfer Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="flex items-center gap-1">
                Transfer Reason <span className="text-destructive">*</span>
              </Label>
              <Select 
                value={reason} 
                onValueChange={(value) => {
                  setReason(value);
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select reason for transfer" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFER_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional details about this transfer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Transfer Summary */}
          {isFormValid && (
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Transfer Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Quantity to Transfer:</span>
                  <span className="font-bold text-lg">{quantityNum} units</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From:</span>
                  <span className="font-medium">{sourceWarehouse?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To:</span>
                  <span className="font-medium">{destinationWarehouse?.name}</span>
                </div>
                <Separator className="my-2" />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">After Transfer - Source:</p>
                    <p className="font-medium text-yellow-600 dark:text-yellow-400">
                      {(sourceWarehouse?.currentStock ?? 0) - quantityNum} units
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">After Transfer - Destination:</p>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      {(destinationWarehouse?.currentStock ?? 0) + quantityNum} units
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleTransfer}
            disabled={isSubmitting || !isFormValid}
            className="min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Transferring...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Transfer Stock
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const StockTransferDialog = memo(StockTransferDialogComponent);
