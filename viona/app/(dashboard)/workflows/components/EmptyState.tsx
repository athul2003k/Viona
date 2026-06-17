"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function EmptyState({
  onCreate,
}: {
  onCreate?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-44  text-center">
      <h2 className="text-xl font-semibold">No workflows found</h2>
      <p className="text-muted-foreground mt-2">
        Create workflows to automate your business logic.
      </p>

      {onCreate && (
        <Button className="mt-6" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      )}
    </div>
  );
}
