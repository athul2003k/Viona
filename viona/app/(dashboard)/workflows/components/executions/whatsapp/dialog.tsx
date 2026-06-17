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
    accountSid: z.string().min(1, "Twilio Account SID is required"),
    authToken: z.string().min(1, "Twilio Auth Token is required"),
    from: z.string().min(1, "From number is required"),
    to: z.string().min(1, "To number is required"),
    content: z.string().min(1, "Message content is required"),
});

export type WhatsappFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: WhatsappFormValues, credentialId: string | null) => void;
    defaultValues?: Partial<WhatsappFormValues>;
    defaultCredentialId?: string | null;
}

export const WhatsappDialog = ({ open, onOpenChange, onSubmit, defaultValues = {}, defaultCredentialId = null }: Props) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            accountSid: defaultValues.accountSid || "",
            authToken: defaultValues.authToken || "",
            from: defaultValues.from || "",
            to: defaultValues.to || "",
            content: defaultValues.content || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                accountSid: defaultValues.accountSid || "",
                authToken: defaultValues.authToken || "",
                from: defaultValues.from || "",
                to: defaultValues.to || "",
                content: defaultValues.content || "",
            });
        }
    }, [open, defaultValues, defaultCredentialId, form]);

    const watchVariableName = form.watch("variableName") || "myWhatsapp";

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
                    <DialogTitle>WhatsApp — Send Message</DialogTitle>
                    <DialogDescription>
                        Send a WhatsApp message via Twilio.
                    </DialogDescription>
                </DialogHeader>

                {/* Setup guide */}
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">How to get your Twilio credentials</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>
                            Go to{" "}
                            <a
                                href="https://console.twilio.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
                            >
                                console.twilio.com <ExternalLink className="size-3" />
                            </a>
                        </li>
                        <li>Find your <strong className="text-foreground">Account SID</strong> and <strong className="text-foreground">Auth Token</strong> on the dashboard</li>
                        <li>Enable the <strong className="text-foreground">WhatsApp Sandbox</strong> under Messaging → Try it out → Send a WhatsApp message</li>
                        <li>Use <code className="text-xs bg-muted px-1 rounded">whatsapp:+14155238886</code> as the From number (sandbox) or your approved number</li>
                    </ol>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">

                        <FormField
                            control={form.control}
                            name="accountSid"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Twilio Account SID</FormLabel>
                                    <FormControl>
                                        <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="authToken"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Twilio Auth Token</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="Your auth token" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="from"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>From (Twilio WhatsApp Number)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="whatsapp:+14155238886" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Your Twilio WhatsApp-enabled number. Prefix with <code className="text-xs bg-muted px-1 rounded">whatsapp:</code> or we will add it automatically.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="to"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>To (Recipient Phone Number)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="whatsapp:+1234567890" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        The recipient's WhatsApp number in international format. Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values.
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
                                        Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values.
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
                                        <Input placeholder="e.g. whatsappResult" {...field} />
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
