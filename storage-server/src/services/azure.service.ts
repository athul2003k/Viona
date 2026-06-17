import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

if (!connectionString || !containerName) {
    throw new Error(
        "Missing required Azure environment variables: AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER_NAME"
    );
}

export const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
export const CONTAINER_NAME = containerName;
