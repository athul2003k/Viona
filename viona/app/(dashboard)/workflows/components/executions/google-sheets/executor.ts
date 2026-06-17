import type { NodeExecutor } from "../types";
import Handlebars from "handlebars";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import crypto from "crypto";
import ky from "ky";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
});

type GoogleSheetsData = {
    variableName?: string;
    action?: "read" | "append";
    spreadsheetId?: string;
    sheetName?: string;
    range?: string;
    values?: string;
    credentialId?: string | null;
}

// Helper to create a signed JWT for Google APIs
const createGoogleAuthToken = async (serviceAccountJson: string) => {
    const credentials = JSON.parse(serviceAccountJson);
    const privateKey = credentials.private_key;
    const clientEmail = credentials.client_email;

    const header = {
        alg: "RS256",
        typ: "JWT"
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now
    };

    const base64Encode = (obj: object) =>
        Buffer.from(JSON.stringify(obj))
            .toString("base64")
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

    const header64 = base64Encode(header);
    const claim64 = base64Encode(claim);

    const signature = crypto.createSign("RSA-SHA256")
        .update(`${header64}.${claim64}`)
        .sign(privateKey, "base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const jwt = `${header64}.${claim64}.${signature}`;

    const response = await ky.post("https://oauth2.googleapis.com/token", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt
        }).toString()
    }).json<{ access_token: string }>();

    return response.access_token;
};


export const googleSheetsExecutor: NodeExecutor<GoogleSheetsData> = async ({ data, nodeId, context, publish }) => {

    await publish(nodeId, "loading");

    if (!data.variableName) {
        await publish(nodeId, "error");
        throw new Error("Variable name is required");
    }

    if (!data.spreadsheetId || !data.sheetName) {
        await publish(nodeId, "error");
        throw new Error("Spreadsheet ID and Sheet Name are required");
    }

    const action = data.action || "read";

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
        await publish(nodeId, "error");
        throw new Error("Failed to load Google Sheets credentials");
    }

    if (!credentials) {
        await publish(nodeId, "error");
        throw new Error("Missing credentials. Please select a valid Google Service Account in the node settings.");
    }

    try {
        const spreadSheetId = Handlebars.compile(data.spreadsheetId)(context);
        const sheetName = Handlebars.compile(data.sheetName)(context);
        
        const accessToken = await createGoogleAuthToken(credentials);

        const buildApiUrl = (rangeOrAction: string) => {
            return `https://sheets.googleapis.com/v4/spreadsheets/${spreadSheetId}/values/'${encodeURIComponent(sheetName)}'!${rangeOrAction}`;
        };

        let resultData: any;

        if (action === "read") {
            const range = Handlebars.compile(data.range || "A1:Z100")(context);
            const apiUrl = buildApiUrl(range);
            
            const response = await ky.get(apiUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }).json<{ values?: any[][] }>();

            resultData = {
                rows: response.values || [],
                rowCount: response.values?.length || 0
            };

        } else if (action === "append") {
            const rawValues = Handlebars.compile(data.values || '[]')(context);
            let parsedValues: any[][];
            try {
                parsedValues = JSON.parse(rawValues);
                if (!Array.isArray(parsedValues)) {
                    throw new Error("Must be an array");
                }
            } catch (e: any) {
                throw new Error(`Failed to parse values JSON: ${e.message}`);
            }

            const apiUrl = `${buildApiUrl("")}:append?valueInputOption=USER_ENTERED`;
            
            const response = await ky.post(apiUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                json: {
                    values: parsedValues
                }
            }).json<{ updates?: { updatedRange?: string, updatedRows?: number } }>();

            resultData = {
                updatedRange: response.updates?.updatedRange || null,
                updatedRows: response.updates?.updatedRows || 0
            };
        }

        await publish(nodeId, "success");

        return {
            ...context,
            [data.variableName]: resultData
        }
    } catch (error: any) {
        await publish(nodeId, "error");
        console.error("Google Sheets Node Error:", error?.response || error);
        throw error;
    }
};
