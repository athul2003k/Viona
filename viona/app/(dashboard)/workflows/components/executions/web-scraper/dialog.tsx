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
    maxLength: z.number().min(100).max(50000).default(5000),
});

export type WebScraperFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: WebScraperFormValues) => void;
    defaultValues?: Partial<WebScraperFormValues>;
}

export const WebScraperDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
    const form = useForm<WebScraperFormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            maxLength: defaultValues.maxLength || 5000,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({ maxLength: defaultValues.maxLength || 5000 });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: WebScraperFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Web Scraper Tool</DialogTitle>
                    <DialogDescription>
                        The AI agent can fetch and read content from any URL. Configure the max response length.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-2">
                        <FormField control={form.control} name="maxLength" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Max Response Length</FormLabel>
                                <FormControl>
                                    <Input type="number" min={100} max={50000} {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                                </FormControl>
                                <FormDescription>Maximum characters to extract (default: 5000)</FormDescription>
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
