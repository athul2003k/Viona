import type { NodeExecutor } from "../types";
import Handlebars from "handlebars";
import { decode } from "html-entities";
import ky from "ky";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
});

type TelegramData = {
    variableName?: string;
    botToken?: string;   // Telegram bot token from @BotFather
    chatId?: string;     // Recipient chat ID (user, group, or channel)
    content?: string;
}

export const telegramExecutor: NodeExecutor<TelegramData> = async ({ data, nodeId, context, publish }) => {

    await publish(nodeId, "loading");

    if (!data.botToken) {
        await publish(nodeId, "error");
        throw new Error("Telegram node: Bot Token is required");
    }

    if (!data.chatId) {
        await publish(nodeId, "error");
        throw new Error("Telegram node: Chat ID is required");
    }

    if (!data.content) {
        await publish(nodeId, "error");
        throw new Error("Telegram node: Message content is required");
    }

    const rawContent = Handlebars.compile(data.content)(context);
    const content = decode(rawContent);

    const telegramUrl = `https://api.telegram.org/bot${data.botToken}/sendMessage`;

    try {
        await ky.post(telegramUrl, {
            json: {
                chat_id: data.chatId,
                text: content.slice(0, 4096),
                parse_mode: "HTML",
            },
        });

        if (!data.variableName) {
            await publish(nodeId, "error");
            throw new Error("Telegram node: Variable name is required");
        }

        await publish(nodeId, "success");

        return {
            ...context,
            [data.variableName]: {
                messageContent: content.slice(0, 4096),
            },
        };
    } catch (error) {
        await publish(nodeId, "error");
        throw error;
    }
};
