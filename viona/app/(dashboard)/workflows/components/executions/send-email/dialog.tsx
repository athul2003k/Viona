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
    smtpHost: z.string().min(1, "SMTP host is required"),
    smtpPort: z.string().default("587"),
    smtpUser: z.string().min(1, "SMTP user is required"),
    smtpPass: z.string().min(1, "SMTP password is required"),
    fromAddress: z.string().email("Must be a valid email"),
    fromName: z.string().optional(),
});

export type SendEmailFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: SendEmailFormValues) => void;
    defaultValues?: Partial<SendEmailFormValues>;
}

export const SendEmailDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
    const form = useForm<SendEmailFormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            smtpHost: defaultValues.smtpHost || "",
            smtpPort: defaultValues.smtpPort || "587",
            smtpUser: defaultValues.smtpUser || "",
            smtpPass: defaultValues.smtpPass || "",
            fromAddress: defaultValues.fromAddress || "",
            fromName: defaultValues.fromName || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                smtpHost: defaultValues.smtpHost || "",
                smtpPort: defaultValues.smtpPort || "587",
                smtpUser: defaultValues.smtpUser || "",
                smtpPass: defaultValues.smtpPass || "",
                fromAddress: defaultValues.fromAddress || "",
                fromName: defaultValues.fromName || "",
            });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: SendEmailFormValues) => {
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
                    <DialogTitle>Send Email Tool</DialogTitle>
                    <DialogDescription>
                        Configure SMTP settings. The AI agent will decide recipients, subject, and body at runtime.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <FormField control={form.control} name="smtpHost" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SMTP Host</FormLabel>
                                    <FormControl><Input placeholder="smtp.gmail.com" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="smtpPort" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Port</FormLabel>
                                    <FormControl><Input placeholder="587" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="smtpUser" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl><Input placeholder="user@gmail.com" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="smtpPass" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password / App Password</FormLabel>
                                <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="fromAddress" render={({ field }) => (
                            <FormItem>
                                <FormLabel>From Email</FormLabel>
                                <FormControl><Input placeholder="noreply@company.com" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="fromName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>From Name (optional)</FormLabel>
                                <FormControl><Input placeholder="Viona Bot" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter className="gap-2 pt-2">
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
