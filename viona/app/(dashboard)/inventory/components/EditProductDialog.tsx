"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

interface ProductData {
  id: string;
  name: string;
  sku: string;
  description?: string;
  image?: string;
  status: string;
  currentPrice: number;
  actualPrice?: number;
  marketPrice?: number;
  priceHistory?: Array<{
    retailPrice: number;
    actualPrice?: number;
    marketPrice?: number;
  }>;
}

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
  initialData?: ProductData | null;
}

interface FormData {
  name: string;
  sku: string;
  description: string;
  image: string;
  status: string;
  price: number;
  actualPrice: number;
  marketPrice: number;
}

const INITIAL_FORM: FormData = {
  name: "",
  sku: "",
  description: "",
  image: "",
  status: "active",
  price: 0,
  actualPrice: 0,
  marketPrice: 0,
};

function EditProductDialogComponent({ open, onOpenChange, onSave, initialData }: EditProductDialogProps) {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Optimized form initialization with useCallback
  const initializeForm = useCallback(() => {
    if (initialData && open) {
      setFormData({
        name: initialData.name || "",
        sku: initialData.sku || "",
        description: initialData.description || "",
        image: initialData.image || "",
        status: initialData.status || "active",
        price: initialData.currentPrice || 0,
        actualPrice: initialData.actualPrice || 
                     initialData.priceHistory?.[0]?.actualPrice || 0,
        marketPrice: initialData.marketPrice || 
                     initialData.priceHistory?.[0]?.marketPrice || 0,
      });
    } else if (!open) {
      setFormData(INITIAL_FORM);
    }
    setError(null);
  }, [initialData, open]);

  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  // Optimized input handler with useCallback
  const handleInputChange = useCallback((field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }, [error]);

  // Form validation
  const validateForm = useCallback((): string | null => {
    if (!formData.name.trim()) return "Product name is required";
    if (!formData.sku.trim()) return "SKU is required";
    if (formData.price < 0) return "Price cannot be negative";
    if (formData.actualPrice < 0) return "Actual price cannot be negative";
    if (formData.marketPrice < 0) return "Market price cannot be negative";
    return null;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSave({
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        description: formData.description.trim() || undefined,
        image: formData.image.trim() || undefined,
        status: formData.status,
        price: formData.price,
        actualPrice: formData.actualPrice || undefined,
        marketPrice: formData.marketPrice || undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update product";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, validateForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter product name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    placeholder="Enter SKU"
                    value={formData.sku}
                    onChange={(e) => handleInputChange("sku", e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter product description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="image">Image URL</Label>
                  <Input
                    id="image"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.image}
                    onChange={(e) => handleInputChange("image", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange("status", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Retail Price * ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price || ""}
                    onChange={(e) => handleInputChange("price", parseFloat(e.target.value) || 0)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actualPrice">Actual Cost ($)</Label>
                  <Input
                    id="actualPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.actualPrice || ""}
                    onChange={(e) => handleInputChange("actualPrice", parseFloat(e.target.value) || 0)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketPrice">Market Price ($)</Label>
                  <Input
                    id="marketPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.marketPrice || ""}
                    onChange={(e) => handleInputChange("marketPrice", parseFloat(e.target.value) || 0)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>• <span className="font-medium">Retail Price:</span> The price customers pay</p>
                <p>• <span className="font-medium">Actual Cost:</span> Your wholesale/cost price (optional)</p>
                <p>• <span className="font-medium">Market Price:</span> Competitor pricing reference (optional)</p>
              </div>
            </CardContent>
          </Card>
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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Updating...
              </>
            ) : (
              "Update Product"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const EditProductDialog = memo(EditProductDialogComponent);
