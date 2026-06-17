import type { NodeExecutor } from "../types";
import Handlebars from "handlebars";
import { decode } from "html-entities";
import ky from "ky";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
});

type DiscordData = {
    variableName?: string;
    webhookUrl?: string;
    content?: string;
    username?: string;
}

export const discordExecutor: NodeExecutor<DiscordData> = async ({ data, nodeId, context, publish }) => {

    await publish(nodeId, "loading");

    if (!data.webhookUrl) {
        await publish(nodeId, "error");
        throw new Error("Discord node: Webhook URL is required");
    }

    if (!data.content) {
        await publish(nodeId, "error");
        throw new Error("Discord node: Content is required");
    }

    const rawContent = Handlebars.compile(data.content)(context);
    const content = decode(rawContent);
    const username = data.username
        ? decode(Handlebars.compile(data.username)(context))
        : undefined;

    try {
        await ky.post(data.webhookUrl!, {
            json: {
                content: content.slice(0, 2000),
                username,
            },
        });

        if (!data.variableName) {
            await publish(nodeId, "error");
            throw new Error("Discord node: Variable name is required");
        }

        await publish(nodeId, "success");

        return {
            ...context,
            [data.variableName]: {
                messageContent: content.slice(0, 2000),
            }
        }
    } catch (error) {
        await publish(nodeId, "error");
        throw error;
    }
};