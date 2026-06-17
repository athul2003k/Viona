// Run this once to set CORS rules on your Azure Blob Storage account
// Usage: bun run scripts/setup-azure-cors.ts
import { BlobServiceClient } from "@azure/storage-blob";

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connStr) {
    console.error("❌ AZURE_STORAGE_CONNECTION_STRING not set in .env");
    process.exit(1);
}

const client = BlobServiceClient.fromConnectionString(connStr);

await client.setProperties({
    cors: [
        {
            allowedOrigins: "*",
            allowedMethods: "GET,PUT,HEAD,OPTIONS,DELETE",
            allowedHeaders: "*",
            exposedHeaders: "*",
            maxAgeInSeconds: 3600,
        },
    ],
});

console.log("✅ Azure Storage CORS rules set successfully.");
console.log("   Allowed: GET, PUT, HEAD, OPTIONS, DELETE from all origins.");
