import type { NodeExecutor } from "../types";
import Handlebars from "handlebars";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai"
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
});

type GeminiData = {
    variableName?: string;
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    credentialId?: string | null;
}

export const geminiExecutor: NodeExecutor<GeminiData> = async ({ data, nodeId, context, publish }) => {

    await publish(nodeId, "loading");

    if (!data.variableName) {
        await publish(nodeId, "error");
        throw new Error("Variable name is required");
    }

    if (!data.userPrompt) {
        await publish(nodeId, "error");
        throw new Error("User prompt is required");
    }

    const systemPrompt = data.systemPrompt
        ? Handlebars.compile(data.systemPrompt)(context)
        : "You are a helpful assistant.";

    const userPrompt = Handlebars.compile(data.userPrompt)(context);

    let credentials = "";

    try {
        let credentialId = data.credentialId;

        if (!credentialId) {
            const node = await prisma.node.findUnique({
                where: { id: nodeId },
                select: { credentialId: true }
            });
            credentialId = node?.credentialId;
        }

        if (credentialId) {
            const credential = await prisma.credential.findUnique({
                where: { id: credentialId }
            });
            if (credential?.value) {
                credentials = decrypt(credential.value);
            }
        }
    } catch (err) {
        console.error("Failed to load credential for node", err);
    }

    const google = createGoogleGenerativeAI({
        apiKey: credentials,
    })

    try {
        const result = await generateText({
            model: google(data.model || "gemini-2.0-flash"),
            system: systemPrompt,
            prompt: userPrompt,
        });

        await publish(nodeId, "success");

        return {
            ...context,
            [data.variableName]: {
                aiResponse: result.text,
            }
        }
    } catch (error) {
        await publish(nodeId, "error");
        throw error;
    }
};