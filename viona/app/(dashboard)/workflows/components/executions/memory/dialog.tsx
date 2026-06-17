"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
    windowSize: z.number().min(1, "Minimum 1 message").max(100, "Maximum 100 messages"),
    memoryKey: z.string().min(1, "Memory key is required")
        .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "Must be a valid variable name" }),
});

export type MemoryFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: MemoryFormValues) => void;
    defaultValues?: Partial<MemoryFormValues>;
}

export const MemoryDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {

    const form = useForm<MemoryFormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            windowSize: defaultValues.windowSize || 10,
            memoryKey: defaultValues.memoryKey || "chatHistory",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                windowSize: defaultValues.windowSize || 10,
                memoryKey: defaultValues.memoryKey || "chatHistory",
            });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto w-full
                [&::-webkit-scrollbar]:w-2
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-gray-300
                [&::-webkit-scrollbar-thumb]:rounded-full
                hover:[&::-webkit-scrollbar-thumb]:bg-gray-400
                dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700
                dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600">
                <DialogHeader>
                    <DialogTitle>Window Buffer Memory</DialogTitle>
                    <DialogDescription>
                        Keeps a sliding window of the last N messages for conversation context.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">

                        <FormField
                            control={form.control}
                            name="windowSize"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Window Size</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={1} max={100} {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                                    </FormControl>
                                    <FormDescription>
                                        Number of recent messages to keep in memory (default: 10)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="memoryKey"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Memory Key</FormLabel>
                                    <FormControl>
                                        <Input placeholder="chatHistory" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Context key used to store and retrieve conversation history
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
