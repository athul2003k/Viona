"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { sendNotification } from "@/lib/rabbitmq";
import {
  invalidateOrgMemberCache,
  invalidateUserCache,
} from "@/lib/auth";
import { getUsageStats } from "@/app/(dashboard)/billing/billing-actions";

/**
 * Get invite details - REQUIRES AUTHENTICATION
 * Only returns details if user is authenticated and email matches
 */
export async function getInviteDetails(token: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Authentication required to view invitation details");
  }

  if (!token?.trim()) {
    throw new Error("Invalid invitation token");
  }

  try {
    // Get current user details
    const currentUser = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: {
        email: true,
        user_id: true,
        clerk_id: true,
      },
    });

    if (!currentUser) {
      throw new Error("User not found. Please contact support.");
    }

    // Fetch invite
    const invite = await prisma.organizationInvite.findUnique({
      where: { token: token.trim() },
      select: {
        invite_id: true,
        email: true,
        role: true,
        status: true,
        expires_at: true,
        org_id: true,
        created_at: true,
        org: {
          select: {
            org_id: true,
            name: true,
            created_at: true,
            creator: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    if (!invite) {
      throw new Error("Invitation not found or has been revoked");
    }

    // Email verification - CRITICAL SECURITY CHECK
    if (invite.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      throw new Error(
        `This invitation is for ${invite.email}. You are signed in as ${currentUser.email}. ` +
        `Please sign in with the correct account or request a new invitation.`
      );
    }

    // Check if invitation has expired
    const isExpired = invite.expires_at
      ? new Date(invite.expires_at) < new Date()
      : true;

    // Check if already a member
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        org_id_user_id: {
          org_id: invite.org_id,
          user_id: currentUser.user_id,
        },
      },
      select: {
        role: true,
        created_at: true,
      },
    });

    if (existingMembership) {
      throw new Error(
        `You are already a member of "${invite.org.name}" with the role: ${existingMembership.role}`
      );
    }

    // Get organization stats
    const [memberCount, productCount, warehouseCount] = await Promise.all([
      prisma.organizationMember.count({
        where: { org_id: invite.org_id },
      }),
      prisma.product.count({
        where: { org_id: invite.org_id },
      }),
      prisma.warehouse.count({
        where: { org_id: invite.org_id },
      }),
    ]);

    return {
      inviteId: invite.invite_id.toString(),
      orgId: invite.org_id.toString(),
      orgName: invite.org.name,
      role: invite.role,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expires_at?.toISOString() || "",
      isExpired,
      invitedBy: invite.org.creator.email,
      orgCreatedAt: invite.org.created_at?.toISOString() || "",
      orgStats: {
        members: memberCount,
        products: productCount,
        warehouses: warehouseCount,
      },
    };
  } catch (error) {
    console.error("Error fetching invite details:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to load invitation details. Please try again.");
  }
}

/**
 * Accept invitation - REQUIRES AUTHENTICATION + EMAIL VERIFICATION
 */
export async function acceptInvite(token: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Authentication required to accept invitation");
  }

  if (!token?.trim()) {
    throw new Error("Invalid invitation token");
  }

  try {
    // Get current user
    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: {
        user_id: true,
        email: true,
        clerk_id: true
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Use transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Fetch and lock the invite
      const invite = await tx.organizationInvite.findUnique({
        where: { token: token.trim() },
        select: {
          invite_id: true,
          org_id: true,
          email: true,
          role: true,
          status: true,
          expires_at: true,
          org: {
            select: {
              name: true,
              org_id: true,
            },
          },
        },
      });

      if (!invite) {
        throw new Error("Invitation not found");
      }

      // Validate invite status
      if (invite.status !== "pending") {
        throw new Error(
          `This invitation has already been ${invite.status}. Please request a new invitation.`
        );
      }

      // Check expiration
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        // Mark as expired
        await tx.organizationInvite.update({
          where: { invite_id: invite.invite_id },
          data: { status: "expired" },
        });
        throw new Error("This invitation has expired. Please request a new one.");
      }

      // CRITICAL: Email verification
      if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new Error(
          `Email mismatch. This invitation is for ${invite.email}, but you are signed in as ${user.email}`
        );
      }

      // Check if already a member
      const existingMember = await tx.organizationMember.findUnique({
        where: {
          org_id_user_id: {
            org_id: invite.org_id,
            user_id: user.user_id,
          },
        },
      });

      if (existingMember) {
        throw new Error("You are already a member of this organization");
      }

      const usageStats = await getUsageStats(invite.org_id.toString());
      if (usageStats && !usageStats.members.allowed) {
        throw new Error("Organization has reached its member limit. The organization owner must upgrade the plan to add more members.");
      }

      // Create organization membership
      await tx.organizationMember.create({
        data: {
          org_id: invite.org_id,
          user_id: user.user_id,
          role: invite.role,
        },
      });

      // Update invite status (NO updated_at field in schema)
      await tx.organizationInvite.update({
        where: { invite_id: invite.invite_id },
        data: {
          status: "accepted",
        },
      });

      return {
        orgId: invite.org_id.toString(),
        orgName: invite.org.name,
        role: invite.role,
      };
    });

    // Send notifications AFTER transaction succeeds
    try {
      // Notify the new member
      await sendNotification({
        userId: user.clerk_id,
        title: `Welcome to ${result.orgName}!`,
        message: `You are now a ${result.role} in the organization`,
        type: "system",
        priority: "HIGH",
        link: `/organization/${result.orgId}`,
      });

      // Notify all admins about new member
      const admins = await prisma.organizationMember.findMany({
        where: {
          org_id: BigInt(result.orgId),
          role: "admin",
        },
        include: {
          user: {
            select: { clerk_id: true, email: true },
          },
        },
      });

      for (const admin of admins) {
        // Don't notify if admin is the new member
        if (admin.user.clerk_id !== userId) {
          await sendNotification({
            userId: admin.user.clerk_id,
            title: "New Team Member",
            message: `${user.email} joined as a ${result.role}`,
            type: "system",
            priority: "MEDIUM",
            link: `/organization/${result.orgId}?tab=members`,
          });
        }
      }
    } catch (notifError) {
      // Log notification errors but don't fail the operation
      console.error("Failed to send notifications:", notifError);
    }

    // Invalidate caches
    await invalidateUserCache();
    await invalidateOrgMemberCache();
    revalidatePath("/organization");
    revalidatePath("/dashboard");
    revalidatePath(`/organization/${result.orgId}`);

    return result.orgId;
  } catch (error) {
    console.error("Error accepting invite:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to accept invitation. Please try again.");
  }
}

/**
 * Decline invitation - REQUIRES AUTHENTICATION + EMAIL VERIFICATION
 */
export async function declineInvite(token: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Authentication required");
  }

  if (!token?.trim()) {
    throw new Error("Invalid invitation token");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { email: true, clerk_id: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const invite = await prisma.organizationInvite.findUnique({
      where: { token: token.trim() },
      select: {
        invite_id: true,
        email: true,
        status: true,
        org: {
          select: { name: true, org_id: true },
        },
      },
    });

    if (!invite) {
      throw new Error("Invitation not found");
    }

    // Email verification
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error("Email mismatch");
    }

    if (invite.status !== "pending") {
      throw new Error("This invitation has already been processed");
    }

    // Update invite status (NO updated_at field)
    await prisma.organizationInvite.update({
      where: { invite_id: invite.invite_id },
      data: {
        status: "declined",
      },
    });

    // Notify admins about declined invitation
    const admins = await prisma.organizationMember.findMany({
      where: {
        org_id: invite.org.org_id,
        role: "admin",
      },
      include: {
        user: {
          select: { clerk_id: true },
        },
      },
    });

    for (const admin of admins) {
      await sendNotification({
        userId: admin.user.clerk_id,
        title: "Invitation Declined",
        message: `${user.email} declined the invitation to join ${invite.org.name}`,
        type: "system",
        priority: "LOW",
        link: `/organization/${invite.org.org_id}?tab=invites`,
      });
    }

    revalidatePath(`/organization/${invite.org.org_id}`);

    return { success: true };
  } catch (error) {
    console.error("Error declining invite:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to decline invitation");
  }
}
