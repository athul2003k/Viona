"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { getWarehousesForDialog } from '@/app/(dashboard)/inventory/actions';
import type { Product } from "@/app/api/inventory/products/route";

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  orgId: string;
  product?: Product | null;
  mode?: 'add' | 'edit';
}

export function AddProductDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  orgId,
  product,
  mode = 'add' 
}: AddProductDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    stock: '',
    price: '',
    image: '',
    description: '',
    warehouseId: '',
  });
  
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  

  // Memoized warehouse fetching function
  const fetchWarehouses = useCallback(async () => {
    setIsLoadingWarehouses(true);
    try {
      const data = await getWarehousesForDialog(orgId);
      console.log('Fetched warehouses:', data); 
      setWarehouses(data || []);
    } catch (error) {
      toast.error('Failed to load warehouses');
      console.error('Error loading warehouses:', error);
      setWarehouses([]);
    } finally {
      setIsLoadingWarehouses(false);
    }
  }, [orgId]);

  // Fetch warehouses when dialog opens
  useEffect(() => {
    console.log('orgid :', orgId);
    if (open && orgId) {
      fetchWarehouses();
    }
  }, [open, orgId, fetchWarehouses]);

  // Reset form when dialog opens/closes or product changes
  useEffect(() => {
    if (open) {
      if (product && mode === 'edit') {
        setFormData({
          name: product.name,
          sku: product.sku,
          stock: product.stock.toString(),
          price: product.price.toString(),
          image: product.image || '',
          description: product.description || '',
          warehouseId: product.warehouseId || '',
        });
      } else if (mode === 'add') {
        const defaultWarehouseId = warehouses.length > 0 ? warehouses[0].id : '';
        setFormData({
          name: '',
          sku: '',
          stock: '',
          price: '',
          image: '',
          description: '',
          warehouseId: defaultWarehouseId,
        });
        
        console.log('Initialized form with warehouse:', defaultWarehouseId);
      }
      setErrors({});
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [open, product, mode, warehouses]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Product name must be at least 2 characters';
    }

    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required';
    }

    if (!formData.stock.trim()) {
      newErrors.stock = 'Stock quantity is required';
    } else {
      const stock = parseInt(formData.stock);
      if (isNaN(stock) || stock < 0) {
        newErrors.stock = 'Stock must be a valid non-negative number';
      }
    }

    if (!formData.price.trim()) {
      newErrors.price = 'Price is required';
    } else {
      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        newErrors.price = 'Price must be a valid non-negative number';
      }
    }

    if (!formData.warehouseId) {
      newErrors.warehouseId = 'Please select a warehouse';
    }

    if (formData.image && !isValidUrl(formData.image)) {
      newErrors.image = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string: string) => {
    if (!string) return true;
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const productData = {
      name: formData.name.trim(),
      sku: formData.sku.trim(),
      stock: parseInt(formData.stock),
      price: parseFloat(formData.price),
      image: formData.image.trim() || null,
      description: formData.description.trim() || undefined,
      warehouseId: formData.warehouseId,
    };

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSave(productData);
      toast.success(`Product ${mode === 'edit' ? 'updated' : 'added'} successfully`);
      onOpenChange(false);
      
      setTimeout(() => {
        setFormData({
          name: '',
          sku: '',
          stock: '',
          price: '',
          image: '',
          description: '',
          warehouseId: '',
        });
        setErrors({});
        setSubmitError(null);
      }, 300);
      
    } catch (error) {
      console.error('Save error:', error);
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  const selectedWarehouse = warehouses.find(w => w.id === formData.warehouseId);

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' 
              ? 'Update the product details below. Changes will be saved immediately.' 
              : 'Fill in the details to add a new product to your inventory.'
            }
          </DialogDescription>
        </DialogHeader>

        {submitError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
            <p className="font-medium">Error saving product</p>
            <p className="mt-1">{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Product Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter product name"
                className={errors.name ? 'border-destructive' : ''}
                disabled={isSubmitting}
                autoFocus={mode === 'add'}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            
            {/* SKU */}
            <div className="grid gap-2">
              <Label htmlFor="sku">
                SKU <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                placeholder="e.g., PROD-001"
                className={errors.sku ? 'border-destructive' : ''}
                disabled={isSubmitting || mode === 'edit'}
              />
              {errors.sku && (
                <p className="text-sm text-destructive">{errors.sku}</p>
              )}
              {mode === 'edit' && (
                <p className="text-xs text-muted-foreground">SKU cannot be changed after creation</p>
              )}
            </div>

            {/* Warehouse Selection */}
            <div className="grid gap-2">
              <Label htmlFor="warehouse" className="flex items-center gap-2">
                <Warehouse className="h-4 w-4" />
                Warehouse <span className="text-destructive">*</span>
              </Label>
              {isLoadingWarehouses ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading warehouses...</span>
                </div>
              ) : warehouses.length === 0 ? (
                <div className="p-3 border rounded-md bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-900">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    No warehouses available. Please create a warehouse first.
                  </p>
                </div>
              ) : (
                <>
                  <Select 
                    value={formData.warehouseId} 
                    onValueChange={(value) => {
                      console.log('Warehouse selected:', value);
                      handleInputChange('warehouseId', value);
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className={errors.warehouseId ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                          {warehouse.address && ` - ${warehouse.address}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.warehouseId && (
                    <p className="text-sm text-destructive">{errors.warehouseId}</p>
                  )}
                  {selectedWarehouse && (
                    <p className="text-xs text-muted-foreground">
                      Product will be stored in <strong>{selectedWarehouse.name}</strong>
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Stock and Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stock">
                  Stock Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', e.target.value)}
                  placeholder="0"
                  className={errors.stock ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {errors.stock && (
                  <p className="text-sm text-destructive">{errors.stock}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="price">
                  Price ($) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="0.00"
                  className={errors.price ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {errors.price && (
                  <p className="text-sm text-destructive">{errors.price}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Optional product description"
                disabled={isSubmitting}
              />
            </div>

            {/* Image URL */}
            <div className="grid gap-2">
              <Label htmlFor="image">Image URL</Label>
              <Input
                id="image"
                type="url"
                value={formData.image}
                onChange={(e) => handleInputChange('image', e.target.value)}
                placeholder="https://example.com/image.jpg"
                className={errors.image ? 'border-destructive' : ''}
                disabled={isSubmitting}
              />
              {errors.image && (
                <p className="text-sm text-destructive">{errors.image}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Optional: Add a URL to an image for this product
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || isLoadingWarehouses || warehouses.length === 0}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'edit' ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                mode === 'edit' ? 'Update Product' : 'Save Product'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}