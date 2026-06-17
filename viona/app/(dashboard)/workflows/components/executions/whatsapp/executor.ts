import type { NodeExecutor } from "../types";
import Handlebars from "handlebars";
import { decode } from "html-entities";
import ky from "ky";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
});

type WhatsappData = {
    variableName?: string;
    accountSid?: string;
    authToken?: string;
    from?: string;       // Twilio WhatsApp number e.g. "whatsapp:+14155238886"
    to?: string;         // Recipient e.g. "whatsapp:+1234567890"
    content?: string;
}

export const whatsappExecutor: NodeExecutor<WhatsappData> = async ({ data, nodeId, context, publish }) => {

    await publish(nodeId, "loading");

    if (!data.accountSid || !data.authToken) {
        await publish(nodeId, "error");
        throw new Error("WhatsApp node: Twilio Account SID and Auth Token are required");
    }

    if (!data.from || !data.to) {
        await publish(nodeId, "error");
        throw new Error("WhatsApp node: From and To phone numbers are required");
    }

    if (!data.content) {
        await publish(nodeId, "error");
        throw new Error("WhatsApp node: Message content is required");
    }

    const rawContent = Handlebars.compile(data.content)(context);
    const content = decode(rawContent);

    const from = data.from.startsWith("whatsapp:") ? data.from : `whatsapp:${data.from}`;
    const to = data.to.startsWith("whatsapp:") ? data.to : `whatsapp:${data.to}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${data.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${data.accountSid}:${data.authToken}`).toString("base64");

    try {
        const body = new URLSearchParams({ From: from, To: to, Body: content });

        await ky.post(twilioUrl, {
            body,
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        if (!data.variableName) {
            await publish(nodeId, "error");
            throw new Error("WhatsApp node: Variable name is required");
        }

        await publish(nodeId, "success");

        return {
            ...context,
            [data.variableName]: {
                messageContent: content.slice(0, 1600),
            }
        };
    } catch (error) {
        await publish(nodeId, "error");
        throw error;
    }
};
