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
        .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "Variable name must start with a letter or underscore" }),
    accessToken: z.string().min(1, "Page Access Token is required"),
    recipientId: z.string().min(1, "Recipient ID (PSID) is required"),
    content: z.string().min(1, "Message content is required").max(1000, "Max 1000 characters"),
});

export type InstagramFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: InstagramFormValues, credentialId: string | null) => void;
    defaultValues?: Partial<InstagramFormValues>;
    defaultCredentialId?: string | null;
}

export const InstagramDialog = ({ open, onOpenChange, onSubmit, defaultValues = {}, defaultCredentialId = null }: Props) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            accessToken: defaultValues.accessToken || "",
            recipientId: defaultValues.recipientId || "",
            content: defaultValues.content || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                accessToken: defaultValues.accessToken || "",
                recipientId: defaultValues.recipientId || "",
                content: defaultValues.content || "",
            });
        }
    }, [open, defaultValues, defaultCredentialId, form]);

    const watchVariableName = form.watch("variableName") || "myInstagram";

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values, defaultCredentialId);
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
                    <DialogTitle>Instagram — Send DM</DialogTitle>
                    <DialogDescription>
                        Send an Instagram Direct Message via the Meta Graph API.
                    </DialogDescription>
                </DialogHeader>

                {/* Setup guide */}
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">How to get your credentials</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>
                            Go to{" "}
                            <a
                                href="https://developers.facebook.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
                            >
                                developers.facebook.com <ExternalLink className="size-3" />
                            </a>
                            {" "}and create an app
                        </li>
                        <li>Link your Facebook Page (connected to your Instagram Business account)</li>
                        <li>Under <strong className="text-foreground">Instagram → API Setup</strong>, generate a <strong className="text-foreground">Page Access Token</strong></li>
                        <li>The <strong className="text-foreground">Recipient ID (PSID)</strong> is the user's Instagram-scoped ID — you get this from webhook events when a user messages your account</li>
                    </ol>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">

                        <FormField
                            control={form.control}
                            name="accessToken"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Page Access Token</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="EAAxxxxx..." {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Your Instagram Page Access Token from the Meta Developer Portal.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="recipientId"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Recipient ID (PSID)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="1234567890 or {{previousNode.psid}}" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        The Instagram user's Page-Scoped ID. Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values from a previous node.
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
                                        Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values. Max 1000 characters.
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
                                        <Input placeholder="e.g. instagramResult" {...field} />
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
    );
};
