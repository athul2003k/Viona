"use server";

import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { CredentialType } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { CredentialListItem } from "./types";

export async function getCredentialsForOrg(orgId: string): Promise<CredentialListItem[]> {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ where: { clerk_id: clerkId } });
    if (!user) throw new Error("User not found");

    const credentials = await prisma.credential.findMany({
        where: {
            org_id: BigInt(orgId),
        },
        orderBy: { created_at: "desc" },
    });

    return credentials.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        value: "••••••••", // Always mask values to the frontend
        createdAt: c.created_at.toISOString(),
        updatedAt: c.updated_at.toISOString(),
    }));
}

export type CredentialOption = { id: string; name: string; };

/** Fetch only credentials matching a given type for the current org (for node selectors). */
export async function getCredentialsByType(
    orgId: string,
    type: CredentialType
): Promise<CredentialOption[]> {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    const credentials = await prisma.credential.findMany({
        where: {
            org_id: BigInt(orgId),
            type,
        },
        select: { id: true, name: true },
        orderBy: { created_at: "desc" },
    });

    return credentials;
}

export async function createCredential({
    name,
    value,
    type,
    orgId,
}: {
    name: string;
    value: string;
    type: CredentialType;
    orgId: string;
}) {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ where: { clerk_id: clerkId } });
    if (!user) throw new Error("User not found");

    const encryptedValue = encrypt(value);

    const credential = await prisma.credential.create({
        data: {
            name,
            value: encryptedValue,
            type,
            userId: user.user_id,
            org_id: BigInt(orgId),
        },
    });

    return { success: true, id: credential.id };
}

export async function deleteCredential(id: string, orgId: string) {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ where: { clerk_id: clerkId } });
    if (!user) throw new Error("User not found");

    // Verify the credential belongs to the org
    const credential = await prisma.credential.findFirst({
        where: { id, org_id: BigInt(orgId) },
    });

    if (!credential) {
        throw new Error("Credential not found or unauthorized");
    }

    await prisma.credential.delete({ where: { id } });

    return { success: true };
}

/** Attach a saved credential to a specific node. */
export async function attachCredentialToNode(nodeId: string, credentialId: string | null) {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    // Update the node's credentialId. Use updateMany to avoid throwing if the node does not exist yet.
    const updateResult = await prisma.node.updateMany({
        where: { id: nodeId },
        data: { credentialId },
    });
    if (updateResult.count === 0) {
        console.warn(`attachCredentialToNode: No node found with id ${nodeId}. This may occur if the node has not been persisted yet.`);
    }

    return { success: true };
}

export async function updateCredential({
    id,
    name,
    value,
    orgId,
}: {
    id: string;
    name: string;
    value?: string;
    orgId: string;
}) {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ where: { clerk_id: clerkId } });
    if (!user) throw new Error("User not found");

    const existing = await prisma.credential.findFirst({
        where: { id, org_id: BigInt(orgId) },
    });

    if (!existing) {
        throw new Error("Credential not found or unauthorized");
    }

    const dataToUpdate: any = { name };

    // Only update the value if it's provided and not the masked dummy value
    if (value && value.trim() !== "" && value !== "••••••••") {
        dataToUpdate.value = encrypt(value);
    }

    await prisma.credential.update({
        where: { id },
        data: dataToUpdate,
    });

    return { success: true };
}

