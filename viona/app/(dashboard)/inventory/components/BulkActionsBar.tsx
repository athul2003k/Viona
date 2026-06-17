import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  X, 
  Trash2,
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface BulkActionsBarProps {
  selectedCount: number;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({ 
  selectedCount, 
  onDeleteSelected, 
  onClearSelection 
}: BulkActionsBarProps) {
  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-medium">
            {selectedCount} selected
          </Badge>
          
          <Separator orientation="vertical" className="h-4" />
          
          <span className="text-sm text-muted-foreground">
            Bulk Actions:
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={onDeleteSelected}
            className="gap-1"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete Selected
          </Button>

          <Separator orientation="vertical" className="h-4" />

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>
    </Card>
  );
}
