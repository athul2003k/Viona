"use client";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateGoogleFormScript } from "./utils";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const GoogleFormTriggerDialog = ({ open, onOpenChange }: Props) => {

    const params = useParams();
    const workflowId = params.workflowId as string;

    //Contruct the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${baseUrl}/api/webhooks/google-form?workflowId=${workflowId}`;

    const copyToClipboard = () => {
        try {
            navigator.clipboard.writeText(webhookUrl);
            toast.success("Webhook URL copied to clipboard");
        } catch (error) {
           toast.error("Failed to copy webhook URL to clipboard");
        }
    }

    return(

        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Google Form Trigger Configuration</DialogTitle>
                    <DialogDescription>
                       Use this webhook URL in your Google Form's App Script to trigger this workflow when the form is submitted.  
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="webhook-url">Webhook URL</Label>
                        <div className="flex gap-2">
                            <Input
                                id="webhook-url"
                                value={webhookUrl}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button 
                               type="button" 
                               size="icon" 
                               variant="outline" 
                               onClick={copyToClipboard}
                            >
                                <CopyIcon className="size-4"/>
                            </Button>
                        </div>
                    </div> 
                    <div className="rounded-lg  p-4 space-y-2">
                        <h4  className="font-medium text-sm">Setup Instructions:</h4>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-4">
                            <li>Open your Google Form</li>
                            <li>Click the three dots and select Apps Script</li>
                            <li>Copy and paste the script below</li>
                            <li>Replace the WEBHOOK_URL with the one provided above</li>
                            <li>Save and click "Triggers" and then Add Trigger</li>
                            <li>Choose: From form - On form submit - Save</li>
                        </ol>
                      <div className="rounded-lg p-4 space-y-3 bg-muted">
                        <h4 className="font-medium text-sm">Google Apps Script:</h4>
                        <Button
                           type="button"
                           variant="outline"
                           onClick={ async() => {
                                const script = generateGoogleFormScript(webhookUrl);
                                try {
                                    await navigator.clipboard.writeText(script);
                                    toast.success("Google Apps Script copied to clipboard");
                                } catch (error) {
                                    toast.error("Failed to copy Google Apps Script to clipboard");
                                }
                           }}
                        >
                            <CopyIcon className="size-4 mr-2"/>
                            Copy Google Apps Script
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            This script includes your webhook URL and handles form submissions
                        </p>
                      </div>
                      <div className="rounded-lg p-4 bg-muted space-y-2">
                        <h4 className="font-medium text-sm">Available Variables</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{googleForm.respondentEmail}}"}
                                </code>
                                -Respondent Email
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{googleForm.responses['Question Name']}}"}
                                </code>
                                -Specific answer
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{json googleForm.responses}}"}
                                </code>
                                -All answers as JSON
                            </li>
                        </ul>
                      </div>
                    </div>                   
                </div>
            </DialogContent>
        </Dialog>
    )
}