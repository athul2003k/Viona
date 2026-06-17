"use client"

import { createId } from "@paralleldrive/cuid2";
import { useReactFlow } from "@xyflow/react";
import {
    GlobeIcon,
    MousePointerIcon,
    Bot,
    MessageSquare,
    BrainCircuit,
    Mail,
    Globe,
    Calculator,
    PackageSearch,
    ShoppingCart,
    Clock,
    SplitSquareHorizontal,
    Table,
} from "lucide-react"
import { useCallback } from "react";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { NodeType } from "@prisma/client"
import { Separator } from "@/components/ui/separator";


export type NodeTypeOption = {
    type: NodeType,
    label: string,
    description: string,
    icon: React.ComponentType<{ className?: string }> | string;
};

const triggerNodes: NodeTypeOption[] = [
    {
        type: NodeType.MANUAL_TRIGGER,
        label: "Trigger manually",
        description: "Runs the flow on clicking a button",
        icon: MousePointerIcon,
    },
    {
        type: NodeType.GOOGLE_FORM_TRIGGER,
        label: "Google Form Trigger",
        description: "Runs the flow when a Google Form is submitted",
        icon: "/logos/googleform.svg",
    },
    {
        type: NodeType.STRIPE_TRIGGER,
        label: "Stripe Event",
        description: "Runs the flow when a Stripe event is triggered",
        icon: "/logos/stripe.svg",
    },
    {
        type: NodeType.INVENTORY_TRIGGER,
        label: "Inventory Trigger",
        description: "Runs when inventory is updated",
        icon: PackageSearch,
    },
    {
        type: NodeType.ORDER_TRIGGER,
        label: "Order Trigger",
        description: "Runs when an order is created or updated",
        icon: ShoppingCart,
    },
    {
        type: NodeType.SCHEDULED_TRIGGER,
        label: "Scheduled",
        description: "Runs on a cron schedule",
        icon: Clock,
    },
];

const executionNodes: NodeTypeOption[] = [
    {
        type: NodeType.HTTP_REQUEST,
        label: "HTTP Request",
        description: "Send an HTTP request",
        icon: GlobeIcon,
    },
    {
        type: NodeType.GEMINI,
        label: "Gemini",
        description: "Use Google Gemini to generate content",
        icon: "/logos/gemini.svg",
    },
    {
        type: NodeType.GROQ,
        label: "Groq",
        description: "Use Groq's fast inference models",
        icon: "/logos/groq.svg",
    },
    {
        type: NodeType.OPENAI,
        label: "OpenAI",
        description: "Use OpenAI to generate content",
        icon: "/logos/openai.svg",
    },
    {
        type: NodeType.GOOGLE_SHEETS,
        label: "Google Sheets",
        description: "Read or append rows using Google Sheets",
        icon: "/logos/googlesheets.svg",
    },
    {
        type: NodeType.ANTHROPIC,
        label: "Anthropic",
        description: "Use Anthropic to generate content",
        icon: "/logos/anthropic.svg",
    },
    {
        type: NodeType.DISCORD,
        label: "Discord",
        description: "Send a message to Discord",
        icon: "/logos/discord.svg",
    },
    {
        type: NodeType.SLACK,
        label: "Slack",
        description: "Send a message to Slack",
        icon: "/logos/slack.svg",
    },
    {
        type: NodeType.WHATSAPP,
        label: "WhatsApp",
        description: "Send a WhatsApp message via Twilio",
        icon: "/logos/whatsapp.svg",
    },
    {
        type: NodeType.INSTAGRAM,
        label: "Instagram",
        description: "Send an Instagram DM via Meta API",
        icon: "/logos/instagram.svg",
    },
    {
        type: NodeType.TELEGRAM,
        label: "Telegram",
        description: "Send a Telegram message via Bot API",
        icon: "/logos/telegram.svg",
    },
    {
        type: NodeType.AI_AGENT,
        label: "AI Agent",
        description: "Autonomous agent with tools, memory & chat model",
        icon: Bot,
    },
    {
        type: NodeType.CONDITIONAL,
        label: "Conditional",
        description: "Branch workflow logic based on context variables",
        icon: SplitSquareHorizontal,
    },

];

const subNodes: NodeTypeOption[] = [
    {
        type: NodeType.CHAT_MODEL,
        label: "Chat Model",
        description: "Select AI provider and model for an agent",
        icon: MessageSquare,
    },
    {
        type: NodeType.MEMORY,
        label: "Memory",
        description: "Window buffer memory for conversation history",
        icon: BrainCircuit,
    },
    {
        type: NodeType.SEND_EMAIL,
        label: "Send Email",
        description: "Send emails via SMTP",
        icon: Mail,
    },
    {
        type: NodeType.WEB_SCRAPER,
        label: "Web Scraper",
        description: "Fetch and read content from URLs",
        icon: Globe,
    },
    {
        type: NodeType.CALCULATOR,
        label: "Calculator",
        description: "Evaluate math expressions",
        icon: Calculator,
    },
    {
        type: NodeType.INVENTORY_LOOKUP,
        label: "Inventory",
        description: "Query products, stock & warehouses",
        icon: PackageSearch,
    },
    {
        type: NodeType.ORDER_MANAGER,
        label: "Orders",
        description: "Search and manage orders",
        icon: ShoppingCart,
    },
];

interface NodeSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export function NodeSelector({
    open,
    onOpenChange,
    children,
}: NodeSelectorProps) {
    const { setNodes, getNodes, screenToFlowPosition } = useReactFlow();


    const handleNodeSelect = useCallback((selection: NodeTypeOption) => {
        if (selection.type === NodeType.MANUAL_TRIGGER) {
            const nodes = getNodes();
            const hasManualTrigger = nodes.some(node => node.type === NodeType.MANUAL_TRIGGER);
            if (hasManualTrigger) {
                toast.error("Only one manual trigger node is allowed per workflow");
                return;
            }
        }
        setNodes((nodes) => {
            const hasInitialTrigger = nodes.some(node => node.type === NodeType.INITIAL);

            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2

            const flowPosition = screenToFlowPosition({
                x: centerX + (Math.random() - 0.5) * 200,
                y: centerY + (Math.random() - 0.5) * 200,
            });

            const newNode = {
                id: createId(),
                type: selection.type,
                position: flowPosition,
                data: {},
            };

            if (hasInitialTrigger) {
                return [newNode];
            }

            return [...nodes, newNode];
        });
        onOpenChange(false);
    }, [setNodes, onOpenChange, getNodes, screenToFlowPosition]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>What triggers this workflow?</SheetTitle>
                    <SheetDescription>
                        A trigger node is the first node in a workflow. It is the node that starts the workflow.
                    </SheetDescription>
                </SheetHeader>
                <div>
                    {triggerNodes.map((nodeType) => {
                        const Icon = nodeType.icon;

                        return (
                            <div
                                key={nodeType.type}
                                className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                                onClick={() => handleNodeSelect(nodeType)}
                            >
                                <div className="flex items-center gap-6 w-full overflow-hidden">
                                    {typeof Icon === "string" ? (
                                        <img src={Icon} alt={nodeType.label} className="size-5 object-contain rounded-sm" />
                                    ) : (
                                        <Icon className="size-5" />
                                    )}
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-medium text-sm">{nodeType.label}</span>
                                        <span className="text-muted-foreground text-xs">{nodeType.description}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Separator />
                <div>
                    {executionNodes.map((nodeType) => {
                        const Icon = nodeType.icon;

                        return (
                            <div
                                key={nodeType.type}
                                className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                                onClick={() => handleNodeSelect(nodeType)}
                            >
                                <div className="flex items-center gap-6 w-full overflow-hidden">
                                    {typeof Icon === "string" ? (
                                        <img src={Icon} alt={nodeType.label} className="size-5 object-contain rounded-sm" />
                                    ) : (
                                        <Icon className="size-5" />
                                    )}
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-medium text-sm">{nodeType.label}</span>
                                        <span className="text-muted-foreground text-xs">{nodeType.description}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Separator />
                <SheetHeader className="px-1 pt-4">
                    <SheetTitle className="text-sm">Agent Nodes</SheetTitle>
                    <SheetDescription className="text-xs">
                        Connect these to an AI Agent&apos;s bottom handles.
                    </SheetDescription>
                </SheetHeader>
                <div>
                    {subNodes.map((nodeType) => {
                        const Icon = nodeType.icon;

                        return (
                            <div
                                key={nodeType.type}
                                className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                                onClick={() => handleNodeSelect(nodeType)}
                            >
                                <div className="flex items-center gap-6 w-full overflow-hidden">
                                    {typeof Icon === "string" ? (
                                        <img src={Icon} alt={nodeType.label} className="size-5 object-contain rounded-sm" />
                                    ) : (
                                        <Icon className="size-5" />
                                    )}
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-medium text-sm">{nodeType.label}</span>
                                        <span className="text-muted-foreground text-xs">{nodeType.description}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </SheetContent>
        </Sheet>
    )
}