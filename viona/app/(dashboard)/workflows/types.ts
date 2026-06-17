export interface WorkflowListItem {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}
