"use client";

import { memo, Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Edit, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect } from "react";



const ImageUpload = dynamic(() =>
  import("@/components/ui/image-upload").then(mod => ({ default: mod.ImageUpload })),
  {
    loading: () => <div className="h-[200px] bg-muted animate-pulse rounded-lg" />,
    ssr: false
  }
);

interface ProductImageCardProps {
  product: {
    name: string;
    image?: string;
    id: string;
  };
  onImageUpdate?: (imageUrl: string) => void;
  editable?: boolean;
  orgId?: string;
  isUpdating?: boolean;
}

function ProductImageCardComponent({
  product,
  onImageUpdate,
  editable = false,
  orgId,
  isUpdating = false
}: ProductImageCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(product.image || "");
  const [isImageUploading, setIsImageUploading] = useState(false);

  const handleImageChange = async (imageUrl: string) => {
    setCurrentImage(imageUrl);
    setIsImageUploading(true);

    try {
      if (onImageUpdate) {
        await onImageUpdate(imageUrl);
      }
    } catch (error) {
      toast.error("Failed to update product image");
      console.error("Image update error:", error);
    } finally {
      setIsImageUploading(false);
    }
  };
  useEffect(() => {
    setCurrentImage(product.image || "");
  }, [product.image]);

  const handleImageRemove = async () => {
    setCurrentImage("");
    setIsImageUploading(true);

    try {
      if (onImageUpdate) {
        await onImageUpdate("");
      }
      toast.success("Product image removed successfully");
    } catch (error) {
      toast.error("Failed to remove product image");
    } finally {
      setIsImageUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Product Image</CardTitle>
          <Badge variant="outline" className="text-xs">
            {product.image ? "Uploaded" : "No Image"}
          </Badge>
        </div>
        {editable && (
          <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            if (!editable) return;
            setIsEditDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Update Product Image</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Suspense fallback={<div className="h-[400px] bg-muted animate-pulse rounded-lg" />}>
                  <div className="relative rounded-md">
                    <ImageUpload
                      value={currentImage}
                      onChange={handleImageChange}
                      onRemove={handleImageRemove}
                      disabled={!editable || !orgId || isImageUploading || isUpdating}
                      maxSizeInMB={10}
                      acceptedFormats={['image/jpeg', 'image/png', 'image/webp']}
                      showPreview={true}
                      uploadPreset="viona_products"
                      className="w-full"
                    />
                    {isImageUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    )}
                  </div>
                </Suspense>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-muted to-muted/60 group relative">
          {currentImage ? (
            <>
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  setCurrentImage("");
                }}
              />
              {/* Image overlay with view button */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="gap-2">
                      <Eye className="h-4 w-4" />
                      View Full Size
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>{product.name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-4">
                      <img
                        src={currentImage}
                        alt={product.name}
                        className="max-w-full max-h-[70vh] object-contain rounded-lg"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Loading overlay when updating */}
              {(isImageUploading || isUpdating) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Updating...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <Package className="h-16 w-16 mb-2" />
              <p className="text-sm font-medium">No image available</p>
              {editable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-2"
                  onClick={() => setIsEditDialogOpen(true)}
                  disabled={isImageUploading || isUpdating}
                >
                  <Edit className="h-4 w-4" />
                  Add Image
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const ProductImageCard = memo(ProductImageCardComponent);
export default ProductImageCard;
