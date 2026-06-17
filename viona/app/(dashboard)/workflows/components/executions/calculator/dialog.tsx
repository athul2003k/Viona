"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Calculator has no config — it's fully AI-driven
export type CalculatorFormValues = Record<string, never>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CalculatorDialog = ({ open, onOpenChange }: Props) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Calculator Tool</DialogTitle>
                    <DialogDescription>
                        This tool lets the AI agent evaluate mathematical expressions at runtime. No configuration needed.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">Capabilities</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Basic arithmetic (+, -, *, /, %)</li>
                        <li>Powers & roots (**, sqrt)</li>
                        <li>Trigonometry (sin, cos, tan)</li>
                        <li>Constants (PI, E)</li>
                    </ul>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
