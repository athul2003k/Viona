"use client";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const StripeTriggerDialog = ({ open, onOpenChange }: Props) => {

    const params = useParams();
    const workflowId = params.workflowId as string;

    //Contruct the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${baseUrl}/api/webhooks/stripe?workflowId=${workflowId}`;

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
                    <DialogTitle>Stripe Trigger Configuration</DialogTitle>
                    <DialogDescription>
                       Use this webhook URL in your Stripe's dashboard to trigger this workflow on payment events.  
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
                            <li>Open your Stripe Dashboard</li>
                            <li>Click on Developers and then Webhooks</li>
                            <li>Click on Add endpoint</li>
                            <li>Enter the WEBHOOK_URL with the one provided above</li>
                            <li>Select the events you want to trigger the workflow( e.g. payment_intent.succeeded )</li>
                            <li>Save and copy the signing secret</li>
                        </ol>

                      <div className="rounded-lg p-4 bg-muted space-y-2">
                        <h4 className="font-medium text-sm">Available Variables</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.amount}}"}
                                </code>
                                - Payment amount
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.currency}}"}
                                </code>
                                - Payment currency
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.customer}}"}
                                </code>
                                - Payment customer
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.paymentIntent}}"}
                                </code>
                                - Payment intent
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.paymentMethod}}"}
                                </code>
                                - Payment method
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.paymentMethodDetails}}"}
                                </code>
                                - Payment method details
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.paymentMethodType}}"}
                                </code>
                                - Payment method type
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.customerId}}"}
                                </code>
                                - Customer ID
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{stripe.paymentIntentId}}"}
                                </code>
                                - Payment intent ID
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{json stripe}"}
                                </code>
                                - Full event data as JSON
                            </li>
                        </ul>
                      </div>
                    </div>                   
                </div>
            </DialogContent>
        </Dialog>
    )
}