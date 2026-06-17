"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
    variableName: z.string()
        .min(1, { message: "Variable name is required" })
        .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "Must be a valid variable name" }),
    systemPrompt: z.string().optional(),
    userPrompt: z.string().min(1, "User prompt is required"),
    maxIterations: z.number().min(1).max(25).default(10),
});

export type AiAgentFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: AiAgentFormValues) => void;
    defaultValues?: Partial<AiAgentFormValues>;
}

export const AiAgentDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {

    const form = useForm<AiAgentFormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            variableName: defaultValues.variableName || "",
            systemPrompt: defaultValues.systemPrompt || "",
            userPrompt: defaultValues.userPrompt || "",
            maxIterations: defaultValues.maxIterations || 10,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                systemPrompt: defaultValues.systemPrompt || "",
                userPrompt: defaultValues.userPrompt || "",
                maxIterations: defaultValues.maxIterations || 10,
            });
        }
    }, [open, defaultValues, form]);

    const watchVariableName = form.watch("variableName") || "agent";

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-full
                [&::-webkit-scrollbar]:w-2
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-gray-300
                [&::-webkit-scrollbar-thumb]:rounded-full
                hover:[&::-webkit-scrollbar-thumb]:bg-gray-400
                dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700
                dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600">
                <DialogHeader>
                    <DialogTitle>AI Agent</DialogTitle>
                    <DialogDescription>
                        Configure the agent&apos;s prompts and behavior. Connect a Chat Model, Memory, and Tool nodes using the bottom handles.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">How it works</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Connect a <strong className="text-foreground">Chat Model</strong> sub-node to set the AI provider &amp; model</li>
                        <li>Connect a <strong className="text-foreground">Memory</strong> sub-node for conversation history</li>
                        <li>Connect <strong className="text-foreground">Tool</strong> nodes (e.g. HTTP Request) the agent can call</li>
                        <li>The agent loops up to <strong className="text-foreground">Max Iterations</strong> times, calling tools as needed</li>
                    </ul>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">

                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Output Variable Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. agent" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Reference from later nodes:{" "}
                                        <code className="text-xs bg-muted px-1 rounded">{`{{${watchVariableName}.agentResponse}}`}</code>
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="systemPrompt"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>System Prompt (optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            className="min-h-[80px] font-mono text-sm"
                                            placeholder="You are a helpful assistant that can use tools to accomplish tasks."
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Sets the agent&apos;s behavior. Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="userPrompt"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>User Prompt</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            className="min-h-[80px] font-mono text-sm"
                                            placeholder="Analyze the data from {{previousNode.output}} and summarize the key findings."
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        The task for the agent.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="maxIterations"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Max Iterations</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={1} max={25} {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                                    </FormControl>
                                    <FormDescription>
                                        Maximum number of tool-calling loops (1–25, default: 10)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="gap-2 pt-2">
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
