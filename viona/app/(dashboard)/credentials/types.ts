import { CredentialType } from "@prisma/client";

export interface CredentialListItem {
    id: string;
    name: string;
    type: CredentialType;
    value: string; // This will essentially be masked value returned to frontend
    createdAt: string; // ISO string 
    updatedAt: string; // ISO string
}
