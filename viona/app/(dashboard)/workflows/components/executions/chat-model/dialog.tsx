"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CredentialSelector } from "../components/CredentialSelector";
import { useOrgStore } from "@/hooks/useOrgStore";
import { CredentialType } from "@prisma/client";

const PROVIDERS = {
    gemini: {
        label: "Google Gemini",
        icon: "/logos/gemini.svg",
        credentialType: "GEMINI" as CredentialType,
        models: [
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-pro",
        ],
    },
    openai: {
        label: "OpenAI",
        icon: "/logos/openai.svg",
        credentialType: "OPENAI" as CredentialType,
        models: [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
        ],
    },
    anthropic: {
        label: "Anthropic",
        icon: "/logos/anthropic.svg",
        credentialType: "ANTHROPIC" as CredentialType,
        models: [
            "claude-sonnet-4-5",
            "claude-3-5-sonnet-20241022",
            "claude-3-haiku-20240307",
        ],
    },
    groq: {
        label: "Groq",
        icon: "/logos/groq.svg",
        credentialType: "GROQ" as CredentialType,
        models: [
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
            "mixtral-8x7b-32768",
        ],
    },
} as const;

export type ProviderKey = keyof typeof PROVIDERS;

const formSchema = z.object({
    provider: z.enum(["gemini", "openai", "anthropic", "groq"]),
    model: z.string().min(1, "Model is required"),
});

export type ChatModelFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: ChatModelFormValues, credentialId: string | null) => void;
    defaultValues?: Partial<ChatModelFormValues>;
    defaultCredentialId?: string | null;
}

export const ChatModelDialog = ({ open, onOpenChange, onSubmit, defaultValues = {}, defaultCredentialId = null }: Props) => {
    const [credentialId, setCredentialId] = useState<string | null>(defaultCredentialId);
    const { selectedOrgId } = useOrgStore();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            provider: defaultValues.provider || "gemini",
            model: defaultValues.model || PROVIDERS.gemini.models[0],
        },
    });

    const watchProvider = form.watch("provider") as ProviderKey;
    const providerConfig = PROVIDERS[watchProvider];

    useEffect(() => {
        if (open) {
            const provider = defaultValues.provider || "gemini";
            form.reset({
                provider,
                model: defaultValues.model || PROVIDERS[provider as ProviderKey].models[0],
            });
            setCredentialId(defaultCredentialId ?? null);
        }
    }, [open, defaultValues, defaultCredentialId, form]);

    // Reset model when provider changes
    useEffect(() => {
        const currentModel = form.getValues("model");
        const availableModels = providerConfig.models as readonly string[];
        if (!availableModels.includes(currentModel)) {
            form.setValue("model", availableModels[0]);
        }
    }, [watchProvider, form, providerConfig.models]);

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values, credentialId);
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
                    <DialogTitle>Chat Model</DialogTitle>
                    <DialogDescription>
                        Select the AI provider, model, and API credential.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">

                        <FormField
                            control={form.control}
                            name="provider"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Provider</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a provider" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.entries(PROVIDERS).map(([key, provider]) => (
                                                <SelectItem key={key} value={key}>
                                                    <div className="flex items-center gap-2">
                                                        <img src={provider.icon} alt={provider.label} className="size-4" />
                                                        {provider.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="model"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Model</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a model" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {providerConfig.models.map((model) => (
                                                <SelectItem key={model} value={model}>{model}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <CredentialSelector
                            orgId={selectedOrgId}
                            credentialType={providerConfig.credentialType}
                            value={credentialId}
                            onChange={setCredentialId}
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
