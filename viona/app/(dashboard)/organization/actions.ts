// app/organization/actions.ts
'use server';

import prisma from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';
import { notifyAsync } from '@/lib/notify';
import { getOrgAccess } from '@/lib/org-access';
import { sendNotification } from '@/lib/rabbitmq';
import crypto from 'crypto';
import {
  getUserRole,
  hasPermission,
  ensureOrganizationMember,
  invalidateUserCache,
  invalidateOrgMemberCache,
} from '@/lib/auth';

type SimpleOrg = {
  id: string;
  name: string;
  role: string;
};

// ============================================
// CACHE TAGS
// ============================================
const CACHE_TAGS = {
  ORGANIZATIONS: 'organizations',
  USER_ORGS: 'user-organizations',
} as const;

// ============================================
// HELPER: Get or create user in DB
// ============================================
async function getOrCreateUser(clerkId: string) {
  let user = await prisma.user.findUnique({
    where: { clerk_id: clerkId },
    select: { user_id: true, email: true, clerk_id: true },
  });

  if (!user) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (!email) throw new Error('Unable to get user email from Clerk');

    user = await prisma.user.create({
      data: {
        clerk_id: clerkId,
        email,
      },
      select: { user_id: true, email: true, clerk_id: true },
    });

    await invalidateUserCache();
  }

  return user;
}

// ============================================
// CACHE INVALIDATION
// ============================================
async function invalidateOrganizationCaches() {
  revalidateTag(CACHE_TAGS.ORGANIZATIONS);
  revalidateTag(CACHE_TAGS.USER_ORGS);
  await invalidateOrgMemberCache();
}


export async function getCachedUserOrganizations(
  clerkId: string
): Promise<SimpleOrg[]> {
  if (!clerkId) return [];

  const cachedFn = unstable_cache(
    async () => {
      const user = await prisma.user.findUnique({
        where: { clerk_id: clerkId },
        select: {
          createdOrganizations: {
            select: { org_id: true, name: true },
          },
          organizationMembers: {
            select: {
              role: true,
              org: { select: { org_id: true, name: true } },
            },
          },
        },
      });

      if (!user) return [];

      const map = new Map<string, SimpleOrg>();

      // creator orgs
      for (const o of user.createdOrganizations) {
        map.set(o.org_id.toString(), {
          id: o.org_id.toString(),
          name: o.name,
          role: 'admin',
        });
      }

      // member orgs
      for (const m of user.organizationMembers) {
        const id = m.org.org_id.toString();
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: m.org.name,
            role: m.role,
          });
        }
      }

      return Array.from(map.values());
    },

    [`user-orgs:${clerkId}`],
    {
      revalidate: 600,
      tags: [CACHE_TAGS.USER_ORGS, CACHE_TAGS.ORGANIZATIONS],
    }
  );


  return cachedFn();
}

export async function getUserOrganizations(): Promise<SimpleOrg[]> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const orgs = await getCachedUserOrganizations(userId);
  if (!orgs) throw new Error('User not found');

  return orgs;
}

// ============================================
// CREATE ORGANIZATION + NOTIFY
// ============================================
export async function createOrganization(name: string) {
  if (!name?.trim()) throw new Error('Name required');

  const { userId, clerkId } = await getAuthContext();

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: { name: name.trim(), created_by: userId },
      select: { org_id: true, name: true },
    });

    await tx.organizationMember.create({
      data: { org_id: created.org_id, user_id: userId, role: 'admin' },
    });

    return created;
  });

  notifyAsync({
    userId: clerkId,
    title: 'Organization Created',
    message: `Created "${org.name}"`,
    type: 'system',
    link: `/organization/${org.org_id}`,
  });

  await invalidateOrganizationCaches();
  revalidatePath('/organization');

  return org.org_id.toString();
}

// ============================================
// UPDATE ORGANIZATION + NOTIFY
// ============================================
export async function updateOrganization(orgId: string, name: string) {
  const orgIdBig = BigInt(orgId);
  const { userId } = await getAuthContext();

  const { isAdmin } = await getOrgAccess(orgIdBig, userId);
  if (!isAdmin) throw new Error('Admins only');

  const org = await prisma.organization.update({
    where: { org_id: orgIdBig },
    data: { name: name.trim() },
    select: { name: true },
  });

  const members = await prisma.organizationMember.findMany({
    where: { org_id: orgIdBig },
    select: { user: { select: { clerk_id: true } } },
  });

  Promise.all(
    members.map(m =>
      notifyAsync({
        userId: m.user.clerk_id,
        title: 'Organization Updated',
        message: `Renamed to "${org.name}"`,
        type: 'system',
        link: `/organization/${orgId}`,
      })
    )
  );

  await invalidateOrganizationCaches();
  revalidatePath('/organization');
}

// ============================================
// DELETE ORGANIZATION + NOTIFY
// ============================================
export async function deleteOrganization(orgId: string, force: boolean = false) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  if (!orgId) throw new Error('Organization ID is required');

  try {
    const bigOrgId = BigInt(orgId);

    await ensureOrganizationMember(orgId);

    const role = await getUserRole(orgId);
    if (!(await hasPermission(role, ['admin']))) {
      throw new Error('Only admins can delete organizations');
    }

    // ✅ Get org name and all members BEFORE deletion
    const orgDetails = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true }
    });

    if (!orgDetails) throw new Error('Organization not found');

    const allMembers = await prisma.organizationMember.findMany({
      where: { org_id: bigOrgId },
      select: {
        user: { select: { clerk_id: true, email: true } }
      }
    });

    // Check for related data
    const [warehouses, products, orders] = await Promise.all([
      prisma.warehouse.count({ where: { org_id: bigOrgId } }),
      prisma.product.count({ where: { org_id: bigOrgId } }),
      prisma.order.count({ where: { org_id: bigOrgId } }),
    ]);

    if ((warehouses > 0 || products > 0 || orders > 0) && !force) {
      const dataDetails = [];
      if (warehouses > 0) dataDetails.push(`${warehouses} warehouse${warehouses === 1 ? '' : 's'}`);
      if (products > 0) dataDetails.push(`${products} product${products === 1 ? '' : 's'}`);
      if (orders > 0) dataDetails.push(`${orders} order${orders === 1 ? '' : 's'}`);

      throw new Error(
        `Cannot delete organization. It contains: ${dataDetails.join(', ')}. ` +
        `To delete this organization and all its data permanently, use the force delete option. ` +
        `This action cannot be undone.`
      );
    }

    // Use transaction for atomic deletion
    await prisma.$transaction(async (tx: any) => {
      if (force && (warehouses > 0 || products > 0 || orders > 0)) {
        // Delete in correct order for foreign key constraints
        await tx.orderItem.deleteMany({
          where: { order: { org_id: bigOrgId } }
        });

        await tx.order.deleteMany({
          where: { org_id: bigOrgId }
        });

        await tx.productPrice.deleteMany({
          where: { product: { org_id: bigOrgId } }
        });

        await tx.productStock.deleteMany({
          where: { product: { org_id: bigOrgId } }
        });

        await tx.product.deleteMany({
          where: { org_id: bigOrgId }
        });

        await tx.warehouse.deleteMany({
          where: { org_id: bigOrgId }
        });
      }

      await tx.organizationInvite.deleteMany({
        where: { org_id: bigOrgId }
      });

      await tx.organizationMember.deleteMany({
        where: { org_id: bigOrgId }
      });

      await tx.organization.delete({
        where: { org_id: bigOrgId }
      });
    });

    // ✅ Notify all members about the deletion
    for (const member of allMembers) {
      await sendNotification({
        userId: member.user.clerk_id,
        title: 'Organization Deleted',
        message: `"${orgDetails.name}" has been permanently deleted${force ? ' along with all its data' : ''}`,
        type: 'system',
        priority: 'HIGH',
        link: '/organization',
      });
    }

    // ✅ Invalidate all organization caches
    await invalidateOrganizationCaches();
    revalidatePath('/organization');
    revalidatePath('/dashboard');
    revalidatePath('/inventory');

    return {
      success: true,
      message: force
        ? 'Organization and all its data have been permanently deleted'
        : 'Organization deleted successfully'
    };

  } catch (error) {
    console.error('Error deleting organization:', error);

    if (error instanceof Error) {
      if (error.message.includes('Cannot convert') && error.message.includes('BigInt')) {
        throw new Error('Invalid organization ID format');
      }

      if (error.message.includes('Foreign key constraint')) {
        throw new Error('Cannot delete organization due to data dependencies. Please use force delete.');
      }

      throw error;
    }

    throw new Error('Failed to delete organization. Please try again.');
  }
}

// ============================================
// INVITE EMPLOYEE + NOTIFY
// ============================================
export async function inviteEmployee(orgId: string, email: string, role: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  if (!orgId) throw new Error('Organization ID is required');
  if (!email?.trim()) throw new Error('Email is required');
  if (!role) throw new Error('Role is required');

  const validRoles = ['admin', 'manager', 'employee', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new Error('Invalid role specified');
  }

  try {
    const bigOrgId = BigInt(orgId);
    const trimmedEmail = email.trim().toLowerCase();

    await ensureOrganizationMember(orgId);

    const currentUserRole = await getUserRole(orgId);
    if (!(await hasPermission(currentUserRole, ['admin', 'manager']))) {
      throw new Error('Only admins and managers can invite members');
    }

    // Get organization details
    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true, org_id: true },
    });

    if (!org) throw new Error('Organization not found');

    // ✅ Check if user with this email exists and is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: {
        clerk_id: true,
        user_id: true,
        email: true,
        organizationMembers: {
          where: { org_id: bigOrgId },
          select: { role: true },
        },
      },
    });

    if (existingUser && existingUser.organizationMembers.length > 0) {
      throw new Error(
        `${trimmedEmail} is already a member of this organization (role: ${existingUser.organizationMembers[0].role})`
      );
    }

    // ✅ Check for existing pending invites
    const existingInvite = await prisma.organizationInvite.findFirst({
      where: {
        org_id: bigOrgId,
        email: trimmedEmail,
        status: 'pending',
      },
      select: {
        invite_id: true,
        role: true,
        expires_at: true,
      },
    });

    if (existingInvite) {
      const isExpired = existingInvite.expires_at && new Date(existingInvite.expires_at) < new Date();

      if (!isExpired) {
        throw new Error(
          `An invitation is already pending for ${trimmedEmail}. ` +
          `Please cancel the existing invitation first if you want to send a new one.`
        );
      } else {
        // Delete expired invite and allow new one
        await prisma.organizationInvite.delete({
          where: { invite_id: existingInvite.invite_id },
        });
      }
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invite
    const invite = await prisma.organizationInvite.create({
      data: {
        org_id: bigOrgId,
        email: trimmedEmail,
        token,
        role,
        status: 'pending',
        expires_at: expiresAt,
      },
    });

    // ✅ Notify the inviter (current user)
    const inviter = await getOrCreateUser(userId);
    await sendNotification({
      userId: inviter.clerk_id,
      title: 'Invitation Sent',
      message: `Invitation sent to ${trimmedEmail} for "${org.name}"`,
      type: 'system',
      priority: 'MEDIUM',
      link: `/organization/${orgId}?tab=invites`,
    });

    // TODO: Send actual email with invite link
    console.log(`Invite link: ${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${token}`);

    if (existingUser) {
      await sendNotification({
        userId: existingUser.clerk_id,
        title: `You're invited to join ${org.name}`,
        message: `You have been invited as a ${role}. Click to accept.`,
        link: `/invite/accept/${token}`,
        type: 'system',
        priority: 'HIGH',
      });
    }


    revalidatePath(`/organization/${orgId}`);

    return token;

  } catch (error) {
    console.error('Error inviting employee:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to send invitation. Please try again.');
  }
}

// ============================================
// ACCEPT INVITE + NOTIFY ALL
// ============================================
export async function acceptInvite(token: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  if (!token?.trim()) throw new Error('Invalid invitation token');

  try {
    const invite = await prisma.organizationInvite.findUnique({
      where: { token: token.trim() },
      select: {
        org_id: true,
        email: true,
        role: true,
        status: true,
        expires_at: true,
        org: { select: { name: true } }
      }
    });

    if (!invite || invite.status !== 'pending') {
      throw new Error('Invalid invitation');
    }

    if (!invite.expires_at || new Date(invite.expires_at) < new Date()) {
      throw new Error('Invitation has expired');
    }

    const user = await getOrCreateUser(userId);

    if (invite.email !== user.email) {
      throw new Error('Email mismatch - invitation not for this user');
    }

    // Check if already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        org_id_user_id: {
          org_id: invite.org_id,
          user_id: user.user_id,
        },
      },
      select: { user_id: true }
    });

    if (existingMember) {
      throw new Error('User is already a member of this organization');
    }

    // Use transaction for atomic operations
    const orgId = await prisma.$transaction(async (tx: any) => {
      await tx.organizationMember.create({
        data: {
          org_id: invite.org_id,
          user_id: user.user_id,
          role: invite.role
        },
      });

      await tx.organizationInvite.update({
        where: { token: token.trim() },
        data: { status: 'accepted' },
      });

      return invite.org_id.toString();
    });

    // ✅ Notify new member
    await sendNotification({
      userId: user.clerk_id,
      title: `Welcome to ${invite.org.name}!`,
      message: `You are now a ${invite.role} in the organization`,
      type: 'system',
      priority: 'HIGH',
      link: `/organization/${orgId}`,
    });

    // ✅ Notify all admins
    const admins = await prisma.organizationMember.findMany({
      where: { org_id: invite.org_id, role: 'admin' },
      include: { user: { select: { clerk_id: true, email: true } } },
    });

    for (const admin of admins) {
      if (admin.user.clerk_id !== userId) {
        await sendNotification({
          userId: admin.user.clerk_id,
          title: 'New member joined',
          message: `${user.email} is now a ${invite.role} in ${invite.org.name}`,
          type: 'system',
          priority: 'MEDIUM',
          link: `/organization/${orgId}?tab=members`,
        });
      }
    }

    // ✅ Invalidate caches - user now has access to new org
    await invalidateOrganizationCaches();
    revalidatePath('/organization');
    revalidatePath('/dashboard');

    return orgId;

  } catch (error) {
    console.error('Error accepting invite:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to accept invitation. Please try again.');
  }
}

// ============================================
// REMOVE MEMBER + NOTIFY
// ============================================
export async function removeMember(orgId: string, memberUserId: string) {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) throw new Error('Unauthorized');

  await ensureOrganizationMember(orgId);

  const role = await getUserRole(orgId);
  if (!(await hasPermission(role, ['admin']))) {
    throw new Error('Only admins can remove members');
  }

  const member = await prisma.organizationMember.findUnique({
    where: {
      org_id_user_id: {
        org_id: BigInt(orgId),
        user_id: BigInt(memberUserId),
      },
    },
    include: {
      user: { select: { clerk_id: true, email: true } },
      org: { select: { name: true } },
    },
  });

  if (!member) throw new Error('Member not found');

  await prisma.organizationMember.delete({
    where: {
      org_id_user_id: {
        org_id: BigInt(orgId),
        user_id: BigInt(memberUserId)
      }
    }
  });

  // ✅ Notify removed member
  await sendNotification({
    userId: member.user.clerk_id,
    title: `Removed from ${member.org.name}`,
    message: 'You have been removed from the organization',
    type: 'system',
    priority: 'HIGH',
    link: '/organization',
  });

  // ✅ Notify remaining admins
  const remainingAdmins = await prisma.organizationMember.findMany({
    where: { org_id: BigInt(orgId), role: 'admin' },
    include: { user: { select: { clerk_id: true } } },
  });

  for (const admin of remainingAdmins) {
    if (admin.user.clerk_id !== currentUserId) {
      await sendNotification({
        userId: admin.user.clerk_id,
        title: 'Member removed',
        message: `${member.user.email} was removed from the organization`,
        type: 'system',
        priority: 'MEDIUM',
        link: `/organization/${orgId}/members`,
      });
    }
  }

  // ✅ Invalidate caches - membership changed
  await invalidateOrganizationCaches();
  revalidatePath('/organization');

  return { success: true };
}

// ============================================
// UPDATE MEMBER ROLE + NOTIFY
// ============================================
export async function updateMemberRole(orgId: string, targetUserId: string, newRole: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  if (!orgId) throw new Error('Organization ID is required');
  if (!targetUserId) throw new Error('Target user ID is required');
  if (!newRole) throw new Error('New role is required');

  const validRoles = ['admin', 'manager', 'employee', 'viewer'];
  if (!validRoles.includes(newRole)) {
    throw new Error('Invalid role specified');
  }

  try {
    const bigOrgId = BigInt(orgId);
    const bigTargetUserId = BigInt(targetUserId);

    await ensureOrganizationMember(orgId);

    const currentUserRole = await getUserRole(orgId);
    if (!(await hasPermission(currentUserRole, ['admin']))) {
      throw new Error('Only admins can update member roles');
    }

    // Get current user's database ID
    const currentUser = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { user_id: true },
    });

    if (!currentUser) throw new Error('User not found');

    // Check if admin is trying to change their own role
    const isSelfUpdate = currentUser.user_id === bigTargetUserId;

    if (isSelfUpdate && newRole !== 'admin') {
      // Count how many admins exist in the organization
      const adminCount = await prisma.organizationMember.count({
        where: {
          org_id: bigOrgId,
          role: 'admin',
        },
      });

      // Prevent if this is the only admin
      if (adminCount <= 1) {
        throw new Error(
          'Cannot change your role. You are the only admin. ' +
          'Please assign another admin before changing your role.'
        );
      }
    }

    // Get target member details
    const targetMember = await prisma.organizationMember.findUnique({
      where: {
        org_id_user_id: {
          org_id: bigOrgId,
          user_id: bigTargetUserId,
        },
      },
      include: {
        user: { select: { clerk_id: true, email: true } },
        org: { select: { name: true } },
      },
    });

    if (!targetMember) throw new Error('Member not found in organization');

    const oldRole = targetMember.role;

    // Don't update if role is the same
    if (oldRole === newRole) {
      return { success: true, message: 'Role unchanged' };
    }

    // Update the role
    await prisma.organizationMember.update({
      where: {
        org_id_user_id: {
          org_id: bigOrgId,
          user_id: bigTargetUserId,
        },
      },
      data: { role: newRole },
    });

    // Notify the member about role change
    await sendNotification({
      userId: targetMember.user.clerk_id,
      title: 'Role Updated',
      message: `Your role in "${targetMember.org.name}" changed from ${oldRole} to ${newRole}`,
      type: 'system',
      priority: 'MEDIUM',
      link: `/organization/${orgId}`,
    });

    // Invalidate caches
    await invalidateOrganizationCaches();
    revalidatePath(`/organization/${orgId}`);

    return { success: true };

  } catch (error) {
    console.error('Error updating member role:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to update member role. Please try again.');
  }
}


export async function getOrganizationStats(orgId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await ensureOrganizationMember(orgId);

  const bigOrgId = BigInt(orgId);

  const [members, products, warehouses, orders] = await Promise.all([
    prisma.organizationMember.count({ where: { org_id: bigOrgId } }),
    prisma.product.count({ where: { org_id: bigOrgId } }),
    prisma.warehouse.count({ where: { org_id: bigOrgId } }),
    prisma.order.count({ where: { org_id: bigOrgId } }),
  ]);

  return { members, products, warehouses, orders };
}

// ============================================
// BATCH GET STATS FOR MULTIPLE ORGS (Performance Optimized)
// ============================================
export async function getBatchOrganizationStats(orgIds: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (orgIds.length === 0) return {};

  const bigOrgIds = orgIds.map(id => BigInt(id));

  // Get user's accessible orgs to validate permissions
  const userOrgs = await getCachedUserOrganizations(userId);
  const accessibleOrgIds = new Set(userOrgs.map(o => o.id));

  // Filter to only orgs the user has access to
  const validOrgIds = bigOrgIds.filter(id => accessibleOrgIds.has(id.toString()));

  if (validOrgIds.length === 0) return {};

  // Batch fetch all stats in parallel
  const [membersData, productsData, warehousesData, ordersData] = await Promise.all([
    prisma.organizationMember.groupBy({
      by: ['org_id'],
      where: { org_id: { in: validOrgIds } },
      _count: true,
    }),
    prisma.product.groupBy({
      by: ['org_id'],
      where: { org_id: { in: validOrgIds } },
      _count: true,
    }),
    prisma.warehouse.groupBy({
      by: ['org_id'],
      where: { org_id: { in: validOrgIds } },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ['org_id'],
      where: { org_id: { in: validOrgIds } },
      _count: true,
    }),
  ]);

  // Build stats map
  const statsMap: Record<string, { members: number; products: number; warehouses: number; orders: number }> = {};

  validOrgIds.forEach(orgId => {
    const orgIdStr = orgId.toString();
    statsMap[orgIdStr] = {
      members: membersData.find(d => d.org_id === orgId)?._count || 0,
      products: productsData.find(d => d.org_id === orgId)?._count || 0,
      warehouses: warehousesData.find(d => d.org_id === orgId)?._count || 0,
      orders: ordersData.find(d => d.org_id === orgId)?._count || 0,
    };
  });

  return statsMap;
}

// ============================================
// GET ORGANIZATION DETAILS
// ============================================
export async function getOrganizationDetails(orgId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await ensureOrganizationMember(orgId);

  const bigOrgId = BigInt(orgId);

  const [org, role, stats, pendingInvites] = await Promise.all([
    prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: {
        org_id: true,
        name: true,
        created_at: true,
      },
    }),
    getUserRole(orgId),
    getOrganizationStats(orgId),
    prisma.organizationInvite.count({
      where: { org_id: bigOrgId, status: 'pending' },
    }),
  ]);

  if (!org) throw new Error('Organization not found');

  return {
    id: org.org_id.toString(),
    name: org.name,
    role,
    createdAt: org.created_at?.toISOString() || new Date().toISOString(),
    stats: {
      ...stats,
      pendingInvites,
    },
  };
}

// ============================================
// GET ORGANIZATION MEMBERS
// ============================================
export async function getOrganizationMembers(orgId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await ensureOrganizationMember(orgId);

  const members = await prisma.organizationMember.findMany({
    where: { org_id: BigInt(orgId) },
    include: {
      user: {
        select: { user_id: true, email: true },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  return members.map((m: any) => ({
    id: m.id.toString(),
    userId: m.user.user_id.toString(),
    email: m.user.email,
    role: m.role,
    joinedAt: m.created_at?.toISOString() || new Date().toISOString(),
  }));
}

// ============================================
// GET ORGANIZATION INVITES
// ============================================
export async function getOrganizationInvites(orgId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await ensureOrganizationMember(orgId);

  const role = await getUserRole(orgId);
  if (!(await hasPermission(role, ['admin']))) {
    throw new Error('Only admins can view invitations');
  }

  const invites = await prisma.organizationInvite.findMany({
    where: { org_id: BigInt(orgId) },
    orderBy: { created_at: 'desc' },
  });

  return invites.map((i: any) => ({
    id: i.invite_id.toString(),
    email: i.email,
    role: i.role,
    status: i.status,
    createdAt: i.created_at?.toISOString() || new Date().toISOString(),
    expiresAt: i.expires_at?.toISOString() || new Date().toISOString(),
  }));
}

// ============================================
// CANCEL INVITE
// ============================================
export async function cancelInvite(orgId: string, inviteId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await ensureOrganizationMember(orgId);

  const role = await getUserRole(orgId);
  if (!(await hasPermission(role, ['admin']))) {
    throw new Error('Only admins can cancel invitations');
  }

  await prisma.organizationInvite.delete({
    where: { invite_id: BigInt(inviteId) },
  });

  revalidatePath(`/organization/${orgId}`);

  return { success: true };
}