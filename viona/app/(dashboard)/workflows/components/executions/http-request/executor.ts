import type { NodeExecutor } from "../types";
import ky, { Options } from "ky";
import Handlebars from "handlebars";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
});

type HttpRequestData = {
    variableName: string;
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: Record<string, string>;
}

export const httpRequestExecutor: NodeExecutor<HttpRequestData> = async ({ data, nodeId, context, publish }) => {

    await publish(nodeId, "loading");

    if (!data.endpoint) {
        await publish(nodeId, "error");
        throw new Error("HTTP Request node: No endpoint configured");
    }

    if (!data.variableName) {
        await publish(nodeId, "error");
        throw new Error("HTTP Request node: No variable name configured");
    }

    if (!data.method) {
        await publish(nodeId, "error");
        throw new Error("HTTP Request node: No method configured");
    }

    try {
        const endpoint = Handlebars.compile(data.endpoint)(context);
        const method = data.method;

        const options: Options = { method };

        if (["POST", "PUT", "PATCH"].includes(method)) {
            const resolved = Handlebars.compile(data.body || "{}")(context);
            options.json = JSON.parse(resolved);
            options.headers = {
                "Content-Type": "application/json",
            };
        }

        if (!endpoint) {
            throw new Error(`Invalid URL: Endpoint resolved to empty string. Template: ${data.endpoint}`);
        }
        try {
            new URL(endpoint);
        } catch (e) {
            throw new Error(`Invalid URL: ${endpoint}. Template: ${data.endpoint}`);
        }

        const response = await ky(endpoint, options);
        const contentType = response.headers.get("content-type");
        const responseData = contentType?.includes("application/json")
            ? await response.json()
            : await response.text();

        const responsePayload = {
            httpResponse: {
                status: response.status,
                statusText: response.statusText,
                data: responseData,
            },
        }

        await publish(nodeId, "success");

        return {
            ...context,
            [data.variableName]: responsePayload,
        };
    } catch (error) {
        await publish(nodeId, "error");
        throw error;
    }
};