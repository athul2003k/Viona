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
import { ExternalLink } from "lucide-react";


const formSchema = z.object({
    variableName: z.string()
        .min(1, { message: "Variable name is required" })
        .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "Variable name must start with a letter or underscore and can only contain letters, numbers, and underscores" }),
    webhookUrl: z.string()
        .min(1, "Webhook URL is required")
        .url("Must be a valid URL")
        .refine((url) => url.startsWith("https://hooks.slack.com/services/"), {
            message: "Must be a Slack Incoming Webhook URL (https://hooks.slack.com/services/...)",
        }),
    content: z
        .string().min(1, "Message content is required"),
});

export type SlackFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: SlackFormValues, credentialId: string | null) => void;
    defaultValues?: Partial<SlackFormValues>;
    defaultCredentialId?: string | null;
};


export const SlackDialog = ({ open, onOpenChange, onSubmit, defaultValues = {}, defaultCredentialId = null }: Props) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            webhookUrl: defaultValues.webhookUrl || "",
            content: defaultValues.content || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                webhookUrl: defaultValues.webhookUrl || "",
                content: defaultValues.content || "",
            });
        }
    }, [open, defaultValues, defaultCredentialId, form]);

    const watchVariableName = form.watch("variableName") || "mySlack";

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
                    <DialogTitle>Slack — Send Message</DialogTitle>
                    <DialogDescription>
                        Send a message to a Slack channel using an Incoming Webhook.
                    </DialogDescription>
                </DialogHeader>

                {/* Setup guide */}
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">How to get your Webhook URL</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>
                            Go to{" "}
                            <a
                                href="https://api.slack.com/apps"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
                            >
                                api.slack.com/apps <ExternalLink className="size-3" />
                            </a>
                            {" "}and create a new app (From scratch)
                        </li>
                        <li>Select <strong className="text-foreground">Incoming Webhooks</strong> → toggle it <strong className="text-foreground">On</strong></li>
                        <li>Click <strong className="text-foreground">Add New Webhook to Workspace</strong> and pick a channel</li>
                        <li>Copy the generated URL and paste it below</li>
                    </ol>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">

                        <FormField
                            control={form.control}
                            name="webhookUrl"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Incoming Webhook URL</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://hooks.slack.com/services/T.../B.../..." {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Paste the webhook URL generated from your Slack app. It starts with <code className="text-xs bg-muted px-1 rounded">https://hooks.slack.com/services/</code>
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Message</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            className="min-h-[100px] font-mono text-sm"
                                            placeholder={`Hello! Here is your update:\n{{previousNode.output}}`}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        The message to post in Slack. Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values from previous nodes, or <code className="text-xs bg-muted px-1 rounded">{"{{json variable}}"}</code> for objects.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Output Variable Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. slackResult" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Reference this node&apos;s output in later nodes as:{" "}
                                        <code className="text-xs bg-muted px-1 rounded">{`{{${watchVariableName}.messageContent}}`}</code>
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
    )
}
