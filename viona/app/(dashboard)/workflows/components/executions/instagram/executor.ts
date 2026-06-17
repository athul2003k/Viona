import type { NodeExecutor } from "../types";
import Handlebars from "handlebars";
import { decode } from "html-entities";
import ky from "ky";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
});

type InstagramData = {
    variableName?: string;
    accessToken?: string;   // Instagram Page Access Token
    recipientId?: string;   // Instagram user's PSID (Page-Scoped ID)
    content?: string;
}

export const instagramExecutor: NodeExecutor<InstagramData> = async ({ data, nodeId, context, publish }) => {

    await publish(nodeId, "loading");

    if (!data.accessToken) {
        await publish(nodeId, "error");
        throw new Error("Instagram node: Page Access Token is required");
    }

    if (!data.recipientId) {
        await publish(nodeId, "error");
        throw new Error("Instagram node: Recipient ID (PSID) is required");
    }

    if (!data.content) {
        await publish(nodeId, "error");
        throw new Error("Instagram node: Message content is required");
    }

    const rawContent = Handlebars.compile(data.content)(context);
    const content = decode(rawContent);

    try {
        await ky.post("https://graph.facebook.com/v19.0/me/messages", {
            searchParams: {
                access_token: data.accessToken,
            },
            json: {
                recipient: { id: data.recipientId },
                message: { text: content.slice(0, 1000) },
            },
        });

        if (!data.variableName) {
            await publish(nodeId, "error");
            throw new Error("Instagram node: Variable name is required");
        }

        await publish(nodeId, "success");

        return {
            ...context,
            [data.variableName]: {
                messageContent: content.slice(0, 1000),
            }
        };
    } catch (error) {
        await publish(nodeId, "error");
        throw error;
    }
};
