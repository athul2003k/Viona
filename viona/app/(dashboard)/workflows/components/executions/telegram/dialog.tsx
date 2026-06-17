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
        .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "Must start with a letter or underscore" }),
    botToken: z.string().min(1, "Bot Token is required"),
    chatId: z.string().min(1, "Chat ID is required"),
    content: z.string().min(1, "Message content is required").max(4096, "Max 4096 characters"),
});

export type TelegramFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: TelegramFormValues, credentialId: string | null) => void;
    defaultValues?: Partial<TelegramFormValues>;
    defaultCredentialId?: string | null;
}

export const TelegramDialog = ({ open, onOpenChange, onSubmit, defaultValues = {}, defaultCredentialId = null }: Props) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            botToken: defaultValues.botToken || "",
            chatId: defaultValues.chatId || "",
            content: defaultValues.content || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                botToken: defaultValues.botToken || "",
                chatId: defaultValues.chatId || "",
                content: defaultValues.content || "",
            });
        }
    }, [open, defaultValues, defaultCredentialId, form]);

    const watchVariableName = form.watch("variableName") || "myTelegram";

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
                    <DialogTitle>Telegram — Send Message</DialogTitle>
                    <DialogDescription>
                        Send a Telegram message via a bot using the Bot API.
                    </DialogDescription>
                </DialogHeader>

                {/* Setup guide */}
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">How to get your Bot Token & Chat ID</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>
                            Open Telegram and search for{" "}
                            <a
                                href="https://t.me/BotFather"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
                            >
                                @BotFather <ExternalLink className="size-3" />
                            </a>
                        </li>
                        <li>Send <strong className="text-foreground">/newbot</strong> and follow the steps to create your bot</li>
                        <li>Copy the <strong className="text-foreground">Bot Token</strong> BotFather gives you</li>
                        <li>Start a chat with your bot, then visit <code className="text-xs bg-muted px-1 rounded">https://api.telegram.org/bot&lt;YOUR_TOKEN&gt;/getUpdates</code> to find your <strong className="text-foreground">Chat ID</strong></li>
                        <li>For channels: add the bot as admin, then use the channel username like <code className="text-xs bg-muted px-1 rounded">@mychannel</code> as the Chat ID</li>
                    </ol>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">

                        <FormField
                            control={form.control}
                            name="botToken"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Bot Token</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="123456:ABC-DEF1234..." {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Your bot token from @BotFather. Keep this secret!
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="chatId"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Chat ID</FormLabel>
                                    <FormControl>
                                        <Input placeholder="123456789 or @channelname or {{previousNode.chatId}}" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        The target chat, user, group, or channel. Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values from a previous node.
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
                                        The message to send. Use <code className="text-xs bg-muted px-1 rounded">{"{{variable}}"}</code> for dynamic values, or <code className="text-xs bg-muted px-1 rounded">{"{{json variable}}"}</code> for objects. HTML tags like <code className="text-xs bg-muted px-1 rounded">&lt;b&gt;bold&lt;/b&gt;</code> are supported. Max 4096 chars.
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
                                        <Input placeholder="e.g. telegramResult" {...field} />
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
