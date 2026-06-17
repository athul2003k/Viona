import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CredentialType } from "@prisma/client";
import { createCredential, updateCredential } from "../credentials-actions";
import { CredentialListItem } from "../types";

const CREDENTIAL_TYPES = [
    { value: "OPENAI", label: "OpenAI" },
    { value: "ANTHROPIC", label: "Anthropic" },
    { value: "GEMINI", label: "Google Gemini" },
    { value: "GROQ", label: "Groq" }
] as const;

interface CreateCredentialModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
    onCreated: () => void;
    credentialToEdit?: CredentialListItem | null;
}

export function CreateCredentialModal({ open, onOpenChange, orgId, onCreated, credentialToEdit }: CreateCredentialModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [type, setType] = useState<CredentialType | "">("");

    const isEdit = !!credentialToEdit;

    useEffect(() => {
        if (open) {
            if (credentialToEdit) {
                setName(credentialToEdit.name);
                setType(credentialToEdit.type);
                setValue(credentialToEdit.value);
            } else {
                setName("");
                setValue("");
                setType("");
            }
        }
    }, [open, credentialToEdit]);

    const handleCreate = async () => {
        if (!name.trim()) return toast.error("Please enter a name");
        if (!type) return toast.error("Please select a provider type");
        if (!value.trim()) return toast.error("Please enter the API key");
        if (!orgId) return toast.error("No organization selected");

        setIsSubmitting(true);

        try {
            if (isEdit && credentialToEdit) {
                await updateCredential({
                    id: credentialToEdit.id,
                    name,
                    value,
                    orgId
                });
                toast.success("Credential updated securely");
            } else {
                await createCredential({
                    name,
                    type: type as CredentialType,
                    value,
                    orgId
                });
                toast.success("Credential created securely");
            }
            onCreated();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error(isEdit ? "Failed to update credential." : "Failed to create credential. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit API Credential" : "Add API Credential"}</DialogTitle>
                    <DialogDescription>
                        Securely store API keys for use across your workflows. Keys are encrypted at rest.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Production OpenAI Key"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="provider">Provider Type</Label>
                        <Select
                            value={type}
                            onValueChange={(val: CredentialType) => setType(val)}
                            disabled={isSubmitting || isEdit}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a provider..." />
                            </SelectTrigger>
                            <SelectContent>
                                {CREDENTIAL_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="key">API Key</Label>
                        <Input
                            id="key"
                            type="password"
                            placeholder="sk-..."
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            disabled={isSubmitting}
                        />
                        {isEdit && <p className="text-xs text-muted-foreground">Leave as initially masked value to keep existing key.</p>}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            isEdit ? "Save Changes" : "Save Credential"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
