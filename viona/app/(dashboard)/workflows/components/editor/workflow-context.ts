"use client";
import { createContext, useContext } from "react";

const WorkflowIdContext = createContext<string>("");

export const WorkflowIdProvider = WorkflowIdContext.Provider;

export function useWorkflowId() {
    return useContext(WorkflowIdContext);
}
