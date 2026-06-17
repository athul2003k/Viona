"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const formSchema = z.object({
    variableName: z.string().min(1, "Variable name is required (e.g., webhook.total_amount)"),
    operator: z.enum(["==", "!=", ">", "<", ">=", "<=", "contains", "not_contains"]),
    value: z.string().min(1, "Comparison value is required"),
});

export type ConditionalFormValues = z.infer<typeof formSchema>;

interface ConditionalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: ConditionalFormValues) => void;
    defaultValues?: Partial<ConditionalFormValues>;
}

export function ConditionalDialog({
    open,
    onOpenChange,
    onSubmit,
    defaultValues,
}: ConditionalDialogProps) {
    const form = useForm<ConditionalFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: "",
            operator: "==",
            value: "",
        },
    });

    useEffect(() => {
        if (open && defaultValues) {
            form.reset({
                variableName: defaultValues.variableName || "",
                operator: defaultValues.operator || "==",
                value: defaultValues.value || "",
            });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: ConditionalFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Configure Conditional Logic</DialogTitle>
                    <DialogDescription>
                        Evaluate a condition based on values in the workflow context. Only standard dot-notation variables are supported.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Variable to Check</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. order.status or webhook.amount" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="operator"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Operator</FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        defaultValue={field.value}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select operator" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="==">Equal To (==)</SelectItem>
                                            <SelectItem value="!=">Not Equal To (!=)</SelectItem>
                                            <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                                            <SelectItem value="<">Less Than (&lt;)</SelectItem>
                                            <SelectItem value=">=">Greater Than or Equal (&gt;=)</SelectItem>
                                            <SelectItem value="<=">Less Than or Equal (&lt;=)</SelectItem>
                                            <SelectItem value="contains">Contains substring</SelectItem>
                                            <SelectItem value="not_contains">Does not contain</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Compare To Value</FormLabel>
                                    <FormControl>
                                        <Input placeholder="100, true, active, etc." {...field} />
                                    </FormControl>
                                    <FormDescription className="text-xs text-muted-foreground mt-1">
                                        Numbers will be automatically cast for numerical operators.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save settings</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
// Need FormDescription from UI lib, adding it as simple span above just in case or we can import it
import { FormDescription } from "@/components/ui/form";
