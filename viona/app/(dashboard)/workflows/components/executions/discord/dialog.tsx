"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";



const formSchema = z.object({
    variableName: z.string()
        .min(1, { message: "Variable name is required" })
        .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "Variable name must start with a letter or underscore and can only contain letters, numbers, and underscores" }),
    webhookUrl: z.string().min(1, "Webhook URL is required"),
    content: z
        .string().min(1, "Content is required")
        .max(2000, "Content must be at most 2000 characters long"),
    username: z.string().optional(),
});

export type DiscordFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: DiscordFormValues, credentialId: string | null) => void;
    defaultValues?: Partial<DiscordFormValues>;
    defaultCredentialId?: string | null;
};


export const DiscordDialog = ({ open, onOpenChange, onSubmit, defaultValues = {}, defaultCredentialId = null }: Props) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            webhookUrl: defaultValues.webhookUrl || "",
            content: defaultValues.content || "",
            username: defaultValues.username || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                webhookUrl: defaultValues.webhookUrl || "",
                content: defaultValues.content || "",
                username: defaultValues.username || "",
            });
        }
    }, [open, defaultValues, defaultCredentialId, form]);

    const watchVariableName = form.watch("variableName") || "myDiscord";

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values, defaultCredentialId);
        onOpenChange(false);
    };


    return (
        <Dialog open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-full
                [&::-webkit-scrollbar]:w-2 
                [&::-webkit-scrollbar-track]:bg-transparent 
                [&::-webkit-scrollbar-thumb]:bg-gray-300 
                [&::-webkit-scrollbar-thumb]:rounded-full 
                hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 
                dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700 
                dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600">
                <DialogHeader>
                    <DialogTitle>Discord</DialogTitle>
                    <DialogDescription>
                        Configure the Discord webhook URL and message content.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-4">

                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem
                                    className="space-y-2"
                                >
                                    <FormLabel>Variable Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="variableName" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Use this name to reference the result in the other nodes: {""}
                                        {`{{${watchVariableName}.text}}`}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="webhookUrl"
                            render={({ field }) => (
                                <FormItem
                                    className="space-y-2"
                                >
                                    <FormLabel>Webhook URL</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://discord.com/api/webhooks/..." {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Get this from  Discord: Channel Settings → Integrations → Webhooks
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem
                                    className="space-y-2"
                                >
                                    <FormLabel>Content</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            className="min-h-[80px] font-mono text-sm"
                                            placeholder="Your message here..."
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        The message to send. Use {"{{variable}}"} for simple dynamic values and {"{{json variable}}"} for complex dynamic values.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Username (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Bot Username" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="gap-2">
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
