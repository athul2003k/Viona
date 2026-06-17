export type WorkflowContext = Record<string, unknown>;

export type PublishFn = (nodeId: string, status: "loading" | "success" | "error") => Promise<void>;

export interface NodeExecutionParams<TData = Record<string, unknown>> {
    data: TData;
    nodeId: string;
    context: WorkflowContext;
    publish: PublishFn;
};

export type NodeExecutor<TData = Record<string, unknown>> = (
    params: NodeExecutionParams<TData>
) => Promise<WorkflowContext>;
