import { Card, CardContent, CardHeader } from "@/components/ui/card";
import clsx from "clsx";

export default function ProductHeaderSkeleton({ className }: { className?: string }) {
  return (
    <Card className={clsx(className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-accent/40 rounded-lg">
              <div className="h-8 w-8 bg-muted rounded animate-pulse mx-auto mb-2" />
              <div className="h-6 w-16 bg-muted rounded animate-pulse mx-auto mb-1" />
              <div className="h-4 w-12 bg-muted rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
