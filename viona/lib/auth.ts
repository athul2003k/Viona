// lib/auth.ts (FIXED - BigInt Serialization Issue)
"use server";

import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { unstable_cache, revalidateTag } from 'next/cache';

// ============================================
// CACHING LAYER - FIXED: Convert BigInt to string
// ============================================

const getCachedUser = unstable_cache(
  async (clerkId: string) => {
    const user = await prisma.user.findUnique({
      where: { clerk_id: clerkId },
      select: { user_id: true, email: true, clerk_id: true }
    });

    if (!user) return null;

    // FIXED: Convert BigInt to string for caching
    return {
      user_id: user.user_id.toString(),
      email: user.email,
      clerk_id: user.clerk_id
    };
  },
  ['user-by-clerk'],
  { revalidate: 600, tags: ['user'] }
);

const getCachedOrgMembership = unstable_cache(
  async (orgId: string, userId: string) => {
    const bigOrgId = BigInt(orgId);
    const bigUserId = BigInt(userId);

    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: {
        org_id: true,
        name: true,
        created_by: true,
        members: {
          where: { user_id: bigUserId },
          select: { role: true },
          take: 1
        }
      }
    });

    if (!org) return null;

    // FIXED: Convert BigInt to string for caching
    return {
      exists: true,
      isCreator: org.created_by.toString() === userId,
      role: org.created_by.toString() === userId ? 'admin' : (org.members[0]?.role || null),
      orgName: org.name
    };
  },
  ['org-membership'],
  { revalidate: 300, tags: ['org-member'] }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getOrCreateUser(userId: string) {
  let user = await getCachedUser(userId);

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser?.emailAddresses[0]?.emailAddress) {
      throw new Error('Unable to get user email');
    }

    const newUser = await prisma.user.create({
      data: {
        clerk_id: userId,
        email: clerkUser.emailAddresses[0].emailAddress
      },
      select: { user_id: true, email: true, clerk_id: true }
    });

    // FIXED: Convert BigInt to string
    user = {
      user_id: newUser.user_id.toString(),
      email: newUser.email,
      clerk_id: newUser.clerk_id
    };

    revalidateTag('user');
  }

  return user;
}

async function ensureCreatorAdminRecord(orgId: string, userId: string) {
  const bigOrgId = BigInt(orgId);
  const bigUserId = BigInt(userId);

  await prisma.organizationMember.upsert({
    where: {
      org_id_user_id: {
        org_id: bigOrgId,
        user_id: bigUserId
      }
    },
    update: { role: 'admin' },
    create: {
      org_id: bigOrgId,
      user_id: bigUserId,
      role: 'admin'
    }
  });

  revalidateTag('org-member');
}

// ============================================
// EXPORTED FUNCTIONS
// ============================================

export async function getUserRole(orgId: string): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const user = await getOrCreateUser(userId);
    const membership = await getCachedOrgMembership(orgId, user.user_id);
    return membership?.role || null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('getUserRole error:', error);
    }
    return null;
  }
}

export async function hasPermission(role: string | null, requiredRoles: string[]): Promise<boolean> {
  if (!role || role === "null" || role === "undefined" || role === "" || role === "NULL") {
    return false;
  }

  if (role === 'admin') return true;
  return requiredRoles.includes(role);
}

export async function ensureOrganizationMember(orgId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('Authentication required');

  if (!orgId || orgId.trim() === '' || orgId === 'undefined' || orgId === 'null') {
    throw new Error(`Invalid organization ID: "${orgId}"`);
  }

  if (!/^\d+$/.test(orgId.trim())) {
    throw new Error(`Organization ID must be numeric: "${orgId}"`);
  }

  try {
    const user = await getOrCreateUser(userId);
    const membership = await getCachedOrgMembership(orgId, user.user_id);

    if (!membership || !membership.exists) {
      throw new Error(`Organization ${orgId} not found`);
    }

    if (!membership.role) {
      throw new Error(
        `Access denied. You are not a member of "${membership.orgName}". Please contact an administrator.`
      );
    }

    if (membership.isCreator) {
      ensureCreatorAdminRecord(orgId, user.user_id).catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to ensure admin record:', err);
        }
      });
    }

  } catch (error) {
    throw error;
  }
}

export async function getUserWithPermissions(
  orgId: string,
  requiredRoles: string[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Authentication required');

  await ensureOrganizationMember(orgId);

  const role = await getUserRole(orgId);
  if (!role || !(await hasPermission(role, requiredRoles))) {
    throw new Error(`Insufficient permissions. Required: ${requiredRoles.join(', ')}`);
  }

  return { userId, role };
}

// ============================================
// CACHE INVALIDATION
// ============================================

export async function invalidateUserCache() {
  revalidateTag('user');
}

export async function invalidateOrgMemberCache() {
  revalidateTag('org-member');
}

export async function debugUserOrgs(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      include: {
        createdOrganizations: {
          select: { org_id: true, name: true }
        },
        organizationMembers: {
          select: {
            role: true,
            org: {
              select: { org_id: true, name: true }
            }
          }
        }
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Debug User Organizations:', {
        user: user?.user_id.toString(),
        createdOrgs: user?.createdOrganizations.map(o => ({
          id: o.org_id.toString(),
          name: o.name
        })),
        memberOrgs: user?.organizationMembers.map(m => ({
          org_id: m.org.org_id.toString(),
          org_name: m.org.name,
          role: m.role
        }))
      });
    }

    return user;
  } catch (error) {
    console.error('debugUserOrgs error:', error);
    return null;
  }
}
