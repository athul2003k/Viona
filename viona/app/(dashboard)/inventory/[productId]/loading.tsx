// app/(dashboard)/inventory/[productId]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Loading() {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="space-y-6 p-6 pt-6">
        {/* Back Button Skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Product Header Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Info Card */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-8 w-3/4 mb-2" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="text-center p-4 rounded-lg bg-muted animate-pulse">
                    <Skeleton className="h-8 w-8 mx-auto mb-2 rounded-full" />
                    <Skeleton className="h-6 w-16 mx-auto mb-1" />
                    <Skeleton className="h-4 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Image Card */}
          <Card>
            <CardContent className="p-6">
              <Skeleton className="w-full aspect-square rounded-lg" />
              <Skeleton className="h-4 w-full mt-4" />
              <Skeleton className="h-4 w-3/4 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-32 rounded-md" />
              ))}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((col) => (
                  <div key={col} className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
