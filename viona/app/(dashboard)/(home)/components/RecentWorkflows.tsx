import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Network } from "lucide-react";

interface Workflow {
    id: string;
    name: string;
    status: string;
    updated_at: string;
}

interface RecentWorkflowsProps {
    workflows: Workflow[];
}

export function RecentWorkflows({ workflows }: RecentWorkflowsProps) {
    return (
        <Card className="col-span-1 shadow-sm border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">Recent Workflows</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Network className="h-4 w-4 text-primary" />
                </div>
            </CardHeader>
            <CardContent>
                {workflows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Network className="h-8 w-8 text-muted-foreground mb-2 opacity-20" />
                        <p className="text-sm text-muted-foreground">No workflows found.</p>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {workflows.map(w => (
                            <div key={w.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold leading-none">{w.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Updated {formatDistanceToNow(new Date(w.updated_at), { addSuffix: true })}
                                    </p>
                                </div>
                                <Badge
                                    variant="outline"
                                    className={`capitalize text-[10px] px-2 py-0 h-4 border-0 shadow-none ${w.status === "published" ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" :
                                            w.status === "draft" ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                        }`}
                                >
                                    {w.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
