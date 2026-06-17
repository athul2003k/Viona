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
import { CredentialSelector } from "../components/CredentialSelector";
import { useOrgStore } from "@/hooks/useOrgStore";

const formSchema = z.object({
    variableName: z.string()
        .min(1, { message: "Variable name is required" })
        .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "Variable name must start with a letter or underscore and can only contain letters, numbers, and underscores" }),
    action: z.enum(["read", "append"]),
    spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
    sheetName: z.string().min(1, "Sheet Name is required"),
    range: z.string().optional(),
    values: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.action === "read" && !data.range) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Range is required for read action",
            path: ["range"],
        });
    }
    if (data.action === "append" && !data.values) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Values are required for append action",
            path: ["values"],
        });
    }
});

export type GoogleSheetsFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: GoogleSheetsFormValues, credentialId: string | null) => void;
    defaultValues?: Partial<GoogleSheetsFormValues>;
    defaultCredentialId?: string | null;
}

export const GoogleSheetsDialog = ({ open, onOpenChange, onSubmit, defaultValues = {}, defaultCredentialId = null }: Props) => {
    const [credentialId, setCredentialId] = useState<string | null>(defaultCredentialId);
    const { selectedOrgId } = useOrgStore();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            action: defaultValues.action || "read",
            spreadsheetId: defaultValues.spreadsheetId || "",
            sheetName: defaultValues.sheetName || "Sheet1",
            range: defaultValues.range || "A1:Z100",
            values: defaultValues.values || '[\n  ["{{value1}}", "{{value2}}"]\n]',
        },
    });

    const action = form.watch("action");

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                action: defaultValues.action || "read",
                spreadsheetId: defaultValues.spreadsheetId || "",
                sheetName: defaultValues.sheetName || "Sheet1",
                range: defaultValues.range || "A1:Z100",
                values: defaultValues.values || '[\n  ["{{value1}}", "{{value2}}"]\n]',
            });
            setCredentialId(defaultCredentialId ?? null);
        }
    }, [open, defaultValues, defaultCredentialId, form]);

    const watchVariableName = form.watch("variableName") || "variableName";

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values, credentialId);
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
                    <DialogTitle>Google Sheets</DialogTitle>
                    <DialogDescription>
                        Read or append rows to a Google Spreadsheet.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-4">

                        <div className="space-y-2">
                            <CredentialSelector
                                orgId={selectedOrgId}
                                credentialType="GOOGLE_SHEETS"
                                value={credentialId}
                                onChange={setCredentialId}
                            />
                            <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground mt-2 leading-relaxed">
                                <strong>How to get credentials:</strong><br />
                                1. Go to Google Cloud Console, create a project, and enable the Google Sheets API.<br />
                                2. Go to IAM & Admin &gt; Service Accounts. Create a Service Account.<br />
                                3. Generate a new JSON key for the Service Account and save it.<br />
                                4. Add the JSON content in Settings &gt; Credentials as a Google Sheets credential.<br />
                                <strong>Important:</strong> You must share your Google Sheet (via the Share button) with the Service Account email address (the <code>client_email</code> found in the JSON key).
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Variable Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="googleSheetsData" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Use this name to reference the result in other nodes. Example: {""}
                                        {action === "read" ? `{{${watchVariableName}.rows}}` : `{{${watchVariableName}.updatedRange}}`}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="action"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Action</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select an action" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="read">Read range</SelectItem>
                                            <SelectItem value="append">Append rows</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="spreadsheetId"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Spreadsheet ID</FormLabel>
                                    <FormControl>
                                        <Input placeholder="1A2B3C..." {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        The long ID from the spreadsheet URL. Note: The Google Service Account email used in Credentials must be invited to edit the sheet!
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="sheetName"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Sheet Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Sheet1" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        The name of the tab at the bottom of the spreadsheet.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {action === "read" && (
                            <FormField
                                control={form.control}
                                name="range"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Range</FormLabel>
                                        <FormControl>
                                            <Input placeholder="A1:Z100" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            The range of cells to read. Supports Handlebars syntax.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {action === "append" && (
                            <FormField
                                control={form.control}
                                name="values"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Values (JSON Array of Arrays)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                {...field}
                                                className="min-h-[120px] font-mono text-sm"
                                                placeholder='[\n  ["John", "Doe"]\n]'
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            The rows to append. Must be a valid JSON array of arrays, representing rows and columns. Supports Handlebars syntax.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

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
