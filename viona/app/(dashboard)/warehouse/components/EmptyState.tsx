"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Warehouse } from "lucide-react";

type Props = {
  onAddWarehouse?: () => void;
};

export function EmptyState({ onAddWarehouse }: Props) {
  return (
    <Card className="p-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-muted">
          <Warehouse className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">No Warehouses Yet</h3>
          <p className="text-muted-foreground max-w-md">
            Get started by creating your first warehouse. A default warehouse will be automatically set up for you.
          </p>
        </div>
        <Button onClick={onAddWarehouse} size="lg" className="mt-2">
          <Warehouse className="h-4 w-4 mr-2" />
          Create Warehouse
        </Button>
      </div>
    </Card>
  );
}
