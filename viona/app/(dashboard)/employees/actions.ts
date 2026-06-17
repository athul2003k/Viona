"use server";

import prisma from "@/lib/prisma";
import { TeamMember, MemberActivity } from "./types";
import { ensureOrganizationMember } from "@/lib/auth";
import { getAuthContext } from "@/lib/auth-context";

/**
 * Get all team members for an organization, filtered by role access.
 * Admins see managers and employees. Managers see only employees.
 */
export async function getTeamMembers(orgId: string): Promise<TeamMember[]> {
  const { clerkId, userId: currentUserId } = await getAuthContext();

  const currentUserOrgAccess = await prisma.organizationMember.findFirst({
    where: {
      org_id: BigInt(orgId),
      user_id: currentUserId,
    },
    select: { role: true },
  });

  if (!currentUserOrgAccess) {
    throw new Error("You do not have access to this organization");
  }

  const role = currentUserOrgAccess.role;
  if (role !== "admin" && role !== "manager") {
    throw new Error("Access denied: only admins and managers can view employees");
  }

  const members = await prisma.organizationMember.findMany({
    where: {
      org_id: BigInt(orgId),
    },
    include: {
      user: {
        select: { user_id: true, email: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  // Calculate stats for each member
  const membersWithStats = await Promise.all(
    members.map(async (m) => {
      const uId = m.user_id;

      const [orders, products, workflows] = await Promise.all([
        prisma.order.count({ where: { placed_by: uId, org_id: BigInt(orgId) } }),
        prisma.product.count({ where: { created_by: uId, org_id: BigInt(orgId) } }),
        prisma.workflow.count({ where: { user_id: uId, org_id: BigInt(orgId) } }),
      ]);

      return {
        id: m.id.toString(),
        userId: m.user.user_id.toString(),
        email: m.user.email,
        role: m.role,
        joinedAt: m.created_at?.toISOString() || new Date().toISOString(),
        stats: {
          orders,
          products,
          workflows,
        },
      };
    })
  );

  return membersWithStats;
}

/**
 * Get activity statistics and recent actions for a specific team member.
 */
export async function getMemberActivity(orgId: string, memberUserId: string): Promise<MemberActivity> {
  await ensureOrganizationMember(orgId);
  
  const mUID = BigInt(memberUserId);
  const oID = BigInt(orgId);

  const [
    orderCount,
    productCreatedCount,
    productModifiedCount,
    workflowCount,
    recentOrders,
    recentProducts,
    recentWorkflows,
  ] = await Promise.all([
    prisma.order.count({ where: { placed_by: mUID, org_id: oID } }),
    prisma.product.count({ where: { created_by: mUID, org_id: oID } }),
    prisma.product.count({ where: { modified_by: mUID, org_id: oID } }),
    prisma.workflow.count({ where: { user_id: mUID, org_id: oID } }),
    
    // Get 5 most recent orders
    prisma.order.findMany({
      where: { placed_by: mUID, org_id: oID },
      orderBy: { created_at: "desc" },
      take: 5,
      select: { order_id: true, created_at: true, status: true, total_amount: true },
    }),

    // Get 5 most recent products
    prisma.product.findMany({
      where: { created_by: mUID, org_id: oID },
      orderBy: { created_at: "desc" },
      take: 5,
      select: { product_id: true, name: true, sku: true, created_at: true },
    }),

    // Get 5 most recent workflows
    prisma.workflow.findMany({
      where: { user_id: mUID, org_id: oID },
      orderBy: { updated_at: "desc" },
      take: 5,
      select: { id: true, name: true, status: true, updated_at: true },
    }),
  ]);

  return {
    orderCount,
    productCreatedCount,
    productModifiedCount,
    workflowCount,
    recentOrders: recentOrders.map(o => ({
      id: o.order_id.toString(),
      date: o.created_at?.toISOString() || "",
      status: o.status || "UNKNOWN",
      total: Number(o.total_amount || 0),
    })),
    recentProducts: recentProducts.map(p => ({
      id: p.product_id.toString(),
      name: p.name || "Unnamed Product",
      sku: p.sku || "",
      createdAt: p.created_at?.toISOString() || "",
    })),
    recentWorkflows: recentWorkflows.map(w => ({
      id: w.id,
      name: w.name,
      status: w.status,
      updatedAt: w.updated_at.toISOString(),
    })),
  };
}

/**
 * Get basic details for a specific team member.
 */
export async function getMemberDetails(orgId: string, memberUserId: string): Promise<TeamMember> {
  await ensureOrganizationMember(orgId);

  const member = await prisma.organizationMember.findFirst({
    where: {
      org_id: BigInt(orgId),
      user_id: BigInt(memberUserId),
    },
    include: {
      user: {
        select: { user_id: true, email: true },
      },
    },
  });

  if (!member) {
    throw new Error("Member not found in this organization");
  }

  return {
    id: member.id.toString(),
    userId: member.user.user_id.toString(),
    email: member.user.email,
    role: member.role,
    joinedAt: member.created_at?.toISOString() || new Date().toISOString(),
  };
}
