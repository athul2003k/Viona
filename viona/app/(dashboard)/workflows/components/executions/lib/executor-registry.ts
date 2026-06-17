import { NodeType } from "@prisma/client";
import { NodeExecutor } from "../types";
import { manualTriggerExecutor } from "../../triggers/manual-trigger/executor";
import { httpRequestExecutor } from "../../executions/http-request/executor";
import { googleFormTriggerExecutor } from "../../triggers/google-form-trigger/executor";
import { stripeTriggerExecutor } from "../../triggers/stripe-trigger/executor";
import { geminiExecutor } from "../../executions/gemini/executor";
import { groqExecutor } from "../../executions/groq/executor";
import { openAiExecutor } from "../../executions/openai/executor";
import { anthropicExecutor } from "../../executions/anthropic/executor";
import { discordExecutor } from "../../executions/discord/executor";
import { slackExecutor } from "../../executions/slack/executor";
import { whatsappExecutor } from "../../executions/whatsapp/executor";
import { instagramExecutor } from "../../executions/instagram/executor";
import { telegramExecutor } from "../../executions/telegram/executor";
import { aiAgentExecutor } from "../../executions/ai-agent/executor";
import { chatModelExecutor } from "../../executions/chat-model/executor";
import { memoryExecutor } from "../../executions/memory/executor";
import { sendEmailExecutor } from "../../executions/send-email/executor";
import { webScraperExecutor } from "../../executions/web-scraper/executor";
import { calculatorExecutor } from "../../executions/calculator/executor";
import { inventoryLookupExecutor } from "../../executions/inventory-lookup/executor";
import { orderManagerExecutor } from "../../executions/order-manager/executor";
import { inventoryTriggerExecutor } from "../../triggers/inventory-trigger/executor";
import { orderTriggerExecutor } from "../../triggers/order-trigger/executor";
import { scheduledTriggerExecutor } from "../../triggers/scheduled-trigger/executor";
import { conditionalExecutor } from "../../executions/conditional/executor";
import { googleSheetsExecutor } from "../../executions/google-sheets/executor";

export const executorRegistry: Record<NodeType, NodeExecutor<any>> = {
    [NodeType.CONDITIONAL]: conditionalExecutor,
    [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
    [NodeType.INITIAL]: manualTriggerExecutor,
    [NodeType.HTTP_REQUEST]: httpRequestExecutor,
    [NodeType.GOOGLE_FORM_TRIGGER]: googleFormTriggerExecutor,
    [NodeType.STRIPE_TRIGGER]: stripeTriggerExecutor,
    [NodeType.GEMINI]: geminiExecutor,
    [NodeType.GROQ]: groqExecutor,
    [NodeType.ANTHROPIC]: anthropicExecutor,
    [NodeType.OPENAI]: openAiExecutor,
    [NodeType.DISCORD]: discordExecutor,
    [NodeType.SLACK]: slackExecutor,
    [NodeType.WHATSAPP]: whatsappExecutor,
    [NodeType.INSTAGRAM]: instagramExecutor,
    [NodeType.TELEGRAM]: telegramExecutor,
    [NodeType.AI_AGENT]: aiAgentExecutor,
    [NodeType.CHAT_MODEL]: chatModelExecutor,
    [NodeType.MEMORY]: memoryExecutor,
    [NodeType.SEND_EMAIL]: sendEmailExecutor,
    [NodeType.WEB_SCRAPER]: webScraperExecutor,
    [NodeType.CALCULATOR]: calculatorExecutor,
    [NodeType.INVENTORY_LOOKUP]: inventoryLookupExecutor,
    [NodeType.ORDER_MANAGER]: orderManagerExecutor,
    [NodeType.INVENTORY_TRIGGER]: inventoryTriggerExecutor,
    [NodeType.ORDER_TRIGGER]: orderTriggerExecutor,
    [NodeType.SCHEDULED_TRIGGER]: scheduledTriggerExecutor,
    [NodeType.GOOGLE_SHEETS]: googleSheetsExecutor,
};

export const getExecutor = (type: NodeType): NodeExecutor => {
    const executor = executorRegistry[type];
    if (!executor) {
        throw new Error(`No executor found for node type: ${type}`);
    }
    return executor;
};
